import asyncio
import base64
from collections import Counter
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np

try:
    import winsound
except ImportError:
    winsound = None

BEEP_CONFIDENCE_THRESHOLD = 0.35  # Only beep when confidence >= this value
BEEP_FREQUENCY = 1000  # Hz
BEEP_DURATION = 300   # milliseconds

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from camera import get_camera
from detector import detect
from database import db
from arduino import arduino
from report_service import build_report_data, generate_report_pdf_bytes, map_canonical_category

app = FastAPI(title="Fabric AI Backend")

# The Render / Cloud Run web service serves the compiled React dashboard as well
# as the API. Keeping this path absolute means it works even when Uvicorn starts
# from the `backend` directory.
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "app" / "dist"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

camera = get_camera()


class State:
    def __init__(self):
        self.latest_frame_bytes = None
        self.is_running = True
        self.inspection_active = True
        self.last_browser_frame_time = 0.0
        self.frame_lock = asyncio.Lock()

        # Stats
        self.total_defects = 0
        self.major_defects = 0
        self.defect_counts = {
            "Stain": 0,
            "Thread": 0,
            "Warp_Weft": 0,
            "hole": 0,
            "seam": 0
        }

        # Tracking
        self.active_tracks = {}  # track_id -> dict
        self.next_track_id = 1
        self.track_timeout = 2.0  # seconds before track is CLOSED
        self.iou_threshold = 0.3
        self.distance_threshold = 150  # pixels fallback
        self.recent_evidence = []  # recent live-captured defect image evidence


state = State()


def _encode_evidence_data_url(img, max_w=420, quality=72):
    try:
        h, w = img.shape[:2]
        if w > max_w and w > 0:
            scale = max_w / float(w)
            img = cv2.resize(img, (max_w, max(1, int(h * scale))))
        ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if ok:
            return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
    except Exception:
        pass
    return None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"[WS_ERROR] Failed to send JSON: {e}")

manager = ConnectionManager()

def get_center(bbox):
    return (
        (bbox["x1"] + bbox["x2"]) / 2,
        (bbox["y1"] + bbox["y2"]) / 2
    )

def calculate_iou(box1, box2):
    x1 = max(box1['x1'], box2['x1'])
    y1 = max(box1['y1'], box2['y1'])
    x2 = min(box1['x2'], box2['x2'])
    y2 = min(box1['y2'], box2['y2'])
    
    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    if inter_area == 0:
        return 0.0
        
    box1_area = (box1['x2'] - box1['x1']) * (box1['y2'] - box1['y1'])
    box2_area = (box2['x2'] - box2['x1']) * (box2['y2'] - box2['y1'])
    
    denom = float(box1_area + box2_area - inter_area)
    if denom <= 0.0:
        return 0.0
    return inter_area / denom

def get_severity(confidence):
    if confidence >= 0.80: return "HIGH"
    if confidence >= 0.60: return "MEDIUM"
    return "LOW"

def match_track(d, tracks, iou_thresh, dist_thresh):
    cx, cy = get_center(d["bbox"])
    best_match_id = None
    best_iou = 0.0
    
    for tid, track in tracks.items():
        iou = calculate_iou(d["bbox"], track["bbox"])
        if iou > best_iou:
            best_iou = iou
            best_match_id = tid
            
    if best_iou >= iou_thresh and best_match_id is not None:
        return tracks[best_match_id]
        
    # Fallback to distance
    best_dist_sq = float('inf')
    best_dist_id = None
    
    for tid, track in tracks.items():
        tcx, tcy = get_center(track["bbox"])
        dist_sq = (tcx - cx)**2 + (tcy - cy)**2
        if dist_sq <= dist_thresh**2 and dist_sq < best_dist_sq:
            best_dist_sq = dist_sq
            best_dist_id = tid
            
    if best_dist_id is not None:
        return tracks[best_dist_id]
            
    return None

def build_production_status():
    return arduino.status()


async def process_frame(frame, force_broadcast=False):
    loop = asyncio.get_running_loop()
    raw_frame = frame.copy()
    detections = await loop.run_in_executor(None, detect, frame)
    current_time = time.time()

    # 1. Cleanup old tracks (LOST -> CLOSED)
    closed_keys = [
        tid for tid, t in state.active_tracks.items()
        if current_time - t["last_seen"] > state.track_timeout
    ]
    for k in closed_keys:
        print(f"[TRACK] track_id={k} CLOSED")
        t = state.active_tracks[k]
        asyncio.create_task(
            db.update_defect_status(t["event_id"], "CLOSED", t["max_confidence"], t["severity"])
        )
        del state.active_tracks[k]

    new_events = []
    current_detections = []

    # 2. Process detections
    for d in detections:
        match = match_track(d, state.active_tracks, state.iou_threshold, state.distance_threshold)

        if match:
            # Update TRACKING state
            match["bbox"] = d["bbox"]
            match["last_seen"] = current_time

            # Class smoothing
            match["class_history"].append(d["class_name"])
            if len(match["class_history"]) > 20:
                match["class_history"].pop(0)

            # Majority vote
            most_common_class = Counter(match["class_history"]).most_common(1)[0][0]
            match["class_name"] = most_common_class

            # Update max confidence and check severity jump
            old_conf = match["max_confidence"]
            new_conf = max(old_conf, d["confidence"])

            if not match.get("reported_major", False) and new_conf >= 0.80:
                state.major_defects += 1  # Upgraded to HIGH
                match["reported_major"] = True

            match["max_confidence"] = new_conf
            match["severity"] = get_severity(new_conf)
            current_detections.append(match)

        else:
            # NEW DEFECT
            tid = state.next_track_id
            state.next_track_id += 1

            event_id = f"DEF-{datetime.now().strftime('%Y%m%d')}-{tid:06d}"

            # Draw annotated snapshot specifically for this new physical defect (with real-time timestamp)
            annotated_copy = raw_frame.copy()
            bx = d["bbox"]
            c_col = (
                (0, 0, 220)
                if d["confidence"] >= 0.80
                else ((0, 140, 255) if d["confidence"] >= 0.60 else (16, 185, 129))
            )
            cv2.rectangle(annotated_copy, (bx["x1"], bx["y1"]), (bx["x2"], bx["y2"]), c_col, 3)
            label_txt = f'{d["class_name"]} {round(d["confidence"] * 100)}%'
            cv2.putText(
                annotated_copy,
                label_txt,
                (bx["x1"], max(25, bx["y1"] - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                c_col,
                2,
            )
            ts_stamp = datetime.now().strftime("LIVE %d-%b-%Y %I:%M:%S %p")
            cv2.putText(
                annotated_copy,
                ts_stamp,
                (12, annotated_copy.shape[0] - 14),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
            )
            orig_data_url = _encode_evidence_data_url(raw_frame)
            ann_data_url = _encode_evidence_data_url(annotated_copy)

            new_track = {
                "track_id": tid,
                "event_id": event_id,
                "class_id": d["class_id"],
                "class_name": d["class_name"],
                "class_history": [d["class_name"]],
                "max_confidence": d["confidence"],
                "bbox": d["bbox"],
                "severity": get_severity(d["confidence"]),
                "last_seen": current_time,
                "start_time": current_time,
                "reported_major": False,
                "fabric_position": arduino.fabric_meters
            }

            print(f"[YOLO] {new_track['class_name']} {new_track['max_confidence']}")
            print(f"[TRACK] New track created track_id={tid}")
            print(f"[EVENT] NEW DEFECT event_id={event_id} class={new_track['class_name']} confidence={new_track['max_confidence']}")

            # Beep alert on local Windows host if winsound is available
            if new_track["max_confidence"] >= BEEP_CONFIDENCE_THRESHOLD:
                if winsound is not None:
                    loop.run_in_executor(None, winsound.Beep, BEEP_FREQUENCY, BEEP_DURATION)

            state.active_tracks[tid] = new_track
            current_detections.append(new_track)
            # Increment stats once per physical defect
            state.total_defects += 1
            if new_track["severity"] == "HIGH":
                state.major_defects += 1
                new_track["reported_major"] = True

            if new_track["class_name"] in state.defect_counts:
                state.defect_counts[new_track["class_name"]] += 1
            else:
                state.defect_counts[new_track["class_name"]] = 1

            now_iso = datetime.now().isoformat()
            event_data = {
                "event_id": event_id,
                "loom_id": "LOOM-01",
                "roll_id": None,
                "track_id": tid,
                "defect_type": new_track["class_name"],
                "class_id": d["class_id"],
                "confidence": new_track["max_confidence"],
                "severity": new_track["severity"],
                "timestamp": now_iso,
                "bbox": new_track["bbox"],
                "fabric_position": new_track["fabric_position"],
                "status": "OPEN",
                "original_image": orig_data_url,
                "annotated_image": ann_data_url,
            }

            if orig_data_url or ann_data_url:
                pos_val = new_track["fabric_position"]
                state.recent_evidence.insert(0, {
                    "event_id": event_id,
                    "defect_name": map_canonical_category(new_track["class_name"]),
                    "raw_defect_type": new_track["class_name"],
                    "confidence_pct": round(new_track["max_confidence"] * 100, 1),
                    "severity": new_track["severity"],
                    "timestamp_display": datetime.now().strftime("%d %b %Y, %I:%M:%S %p"),
                    "meter_position": f"{float(pos_val):.2f} m" if (pos_val is not None and float(pos_val) > 0) else ("0.00 m" if pos_val == 0 else "Unmeasured"),
                    "bbox": new_track["bbox"],
                    "original_image": orig_data_url,
                    "annotated_image": ann_data_url,
                })
                state.recent_evidence = state.recent_evidence[:12]

            asyncio.create_task(db.save_defect_event(event_data))

            # Send to frontend as NEW event
            new_events.append(event_data)

        # Draw on frame using CURRENT confidence
        bbox = d["bbox"]
        x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
        label = f'{d["class_name"]} {d["confidence"]:.2f}'

        color = (
            (0, 0, 200)
            if d["confidence"] >= 0.80
            else ((0, 165, 255) if d["confidence"] >= 0.60 else (128, 128, 128))
        )
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, label, (x1, max(25, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    # Encode annotated frame for /video stream fallback
    success, encoded = cv2.imencode(".jpg", frame)
    if success:
        state.latest_frame_bytes = encoded.tobytes()

    frame_h, frame_w = frame.shape[:2]
    frontend_current = [
        {
            "track_id": t["track_id"],
            "class_name": t["class_name"],
            "confidence": t["max_confidence"],
            "severity": t["severity"],
            "bbox": t["bbox"],
        }
        for t in state.active_tracks.values()
    ]
    frame_detections = [
        {
            "class_name": d["class_name"],
            "confidence": d["confidence"],
            "severity": get_severity(d["confidence"]),
            "bbox": d["bbox"],
        }
        for d in detections
    ]

    event_payload = {
        "timestamp": datetime.now().isoformat(),
        "loom_id": "LOOM-01",
        "current_detections": frontend_current,
        "frame_detections": frame_detections,
        "frame_size": {"width": frame_w, "height": frame_h},
        "new_events": new_events,
        "stats": {
            "total_defects": state.total_defects,
            "major_defects": state.major_defects,
            "defect_counts": state.defect_counts
        },
        "production": build_production_status()
    }

    if force_broadcast or len(new_events) > 0:
        await manager.broadcast(event_payload)
        if len(new_events) > 0:
            print("[WS] Sent new defect event data")

    return event_payload


async def async_background_loop():
    loop = asyncio.get_running_loop()
    last_ws_send = 0.0
    ws_throttle = 1.0 / 10.0  # 10 updates per sec max

    while state.is_running:
        try:
            current_time = time.time()

            # If browser camera is actively streaming frames (within last 2.5s),
            # skip reading the server's local camera so they don't conflict.
            if current_time - state.last_browser_frame_time < 2.5:
                await asyncio.sleep(0.1)
                continue

            if not state.inspection_active or camera is None:
                # Still broadcast status updates periodically even when camera is idle
                if current_time - last_ws_send >= 1.0:
                    await manager.broadcast({
                        "timestamp": datetime.now().isoformat(),
                        "loom_id": "LOOM-01",
                        "current_detections": [],
                        "frame_detections": [],
                        "new_events": [],
                        "stats": {
                            "total_defects": state.total_defects,
                            "major_defects": state.major_defects,
                            "defect_counts": state.defect_counts
                        },
                        "production": build_production_status()
                    })
                    last_ws_send = current_time
                await asyncio.sleep(0.1)
                continue

            success, frame = await loop.run_in_executor(None, camera.read)
            if not success or frame is None:
                if current_time - last_ws_send >= 1.0:
                    await manager.broadcast({
                        "timestamp": datetime.now().isoformat(),
                        "loom_id": "LOOM-01",
                        "current_detections": [],
                        "frame_detections": [],
                        "new_events": [],
                        "stats": {
                            "total_defects": state.total_defects,
                            "major_defects": state.major_defects,
                            "defect_counts": state.defect_counts
                        },
                        "production": build_production_status()
                    })
                    last_ws_send = current_time
                await asyncio.sleep(0.05)
                continue

            should_send = (current_time - last_ws_send) > ws_throttle
            async with state.frame_lock:
                await process_frame(frame, force_broadcast=should_send)
            if should_send:
                last_ws_send = time.time()

            await asyncio.sleep(0.01)

        except Exception as e:
            print(f"[ERROR] Exception in background loop: {e}")
            await asyncio.sleep(0.5)


@app.on_event("startup")
async def startup_event():
    await db.connect()
    # Hydrate today's saved stats & next unique track_id from MongoDB so existing data is never lost or duplicated
    if db.connected:
        try:
            saved_stats = await db.get_stats()
            state.total_defects = saved_stats.get("total_defects", 0)
            state.major_defects = saved_stats.get("major_defects", 0)
            for k, v in (saved_stats.get("defect_counts") or {}).items():
                state.defect_counts[k] = v
            state.next_track_id = await db.get_next_track_id()
            print(
                f"[STARTUP] Restored stats from MongoDB: total={state.total_defects}, "
                f"major={state.major_defects}, next_track_id={state.next_track_id}"
            )
        except Exception as e:
            print(f"[STARTUP] Could not hydrate initial stats: {e}")
    arduino.start()
    asyncio.create_task(async_background_loop())


@app.on_event("shutdown")
async def shutdown_event():
    arduino.stop_motor()
    arduino.stop()
    db.disconnect()


async def video_generator():
    while True:
        if state.latest_frame_bytes is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + state.latest_frame_bytes
                + b"\r\n"
            )
        await asyncio.sleep(0.033)  # ~30fps max


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "service": "Weave Kiran Fabric AI",
        "database_connected": db.connected,
    }


@app.get("/video")
def video():
    return StreamingResponse(
        video_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


def _decode_browser_frame(data_str: str):
    if "," in data_str:
        data_str = data_str.split(",", 1)[1]
    raw_bytes = base64.b64decode(data_str)
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


@app.websocket("/ws/detections")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            frame = None
            if message.get("bytes"):
                arr = np.frombuffer(message["bytes"], dtype=np.uint8)
                frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            elif message.get("text"):
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "frame" and data.get("image"):
                        frame = _decode_browser_frame(data["image"])
                except Exception:
                    frame = None

            if frame is not None:
                state.last_browser_frame_time = time.time()
                if state.inspection_active:
                    async with state.frame_lock:
                        await process_frame(frame, force_broadcast=True)
                else:
                    await websocket.send_json({
                        "timestamp": datetime.now().isoformat(),
                        "loom_id": "LOOM-01",
                        "current_detections": [],
                        "frame_detections": [],
                        "new_events": [],
                        "stats": {
                            "total_defects": state.total_defects,
                            "major_defects": state.major_defects,
                            "defect_counts": state.defect_counts
                        },
                        "production": build_production_status()
                    })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] Disconnected with error: {e}")
        manager.disconnect(websocket)


@app.get("/status")
def get_status():
    return {
        "status": "running",
        "loom_id": "LOOM-01",
        "model": "YOLO26s",
        "camera": "Browser / DroidCam",
        "camera_index": 1,
        **build_production_status()
    }


@app.post("/api/loom/start")
async def start_loom():
    if not arduino.connected:
        raise HTTPException(status_code=503, detail="Arduino is not connected from your device")
    if not arduino.start_motor():
        raise HTTPException(status_code=503, detail="Arduino is not connected from your device")
    prod = build_production_status()
    await manager.broadcast({
        "timestamp": datetime.now().isoformat(),
        "loom_id": "LOOM-01",
        "stats": {
            "total_defects": state.total_defects,
            "major_defects": state.major_defects,
            "defect_counts": state.defect_counts
        },
        "production": prod
    })
    return {"ok": True, **prod}


@app.post("/api/loom/stop")
async def stop_loom():
    if not arduino.connected:
        raise HTTPException(status_code=503, detail="Arduino is not connected from your device")
    if not arduino.stop_motor():
        raise HTTPException(status_code=503, detail="Arduino is not connected from your device")
    prod = build_production_status()
    await manager.broadcast({
        "timestamp": datetime.now().isoformat(),
        "loom_id": "LOOM-01",
        "stats": {
            "total_defects": state.total_defects,
            "major_defects": state.major_defects,
            "defect_counts": state.defect_counts
        },
        "production": prod
    })
    return {"ok": True, **prod}


@app.post("/api/reset")
async def reset_session():
    if not arduino.connected:
        raise HTTPException(status_code=503, detail="Arduino is not connected from your device")
    if not arduino.reset_motor():
        raise HTTPException(status_code=503, detail="Arduino is not connected from your device")

    state.total_defects = 0
    state.major_defects = 0
    state.defect_counts = {
        "Stain": 0,
        "Thread": 0,
        "Warp_Weft": 0,
        "hole": 0,
        "seam": 0
    }
    state.active_tracks.clear()
    state.next_track_id = 1

    prod = build_production_status()
    await manager.broadcast({
        "timestamp": datetime.now().isoformat(),
        "loom_id": "LOOM-01",
        "current_detections": [],
        "frame_detections": [],
        "stats": {
            "total_defects": state.total_defects,
            "major_defects": state.major_defects,
            "defect_counts": state.defect_counts
        },
        "production": prod
    })

    # Stored database history is preserved (deleted: 0) so existing data is never lost
    return {"ok": True, "deleted": 0, "message": "Session reset; reverse mode active", **prod}


@app.get("/stats")
async def get_stats():
    stats = await db.get_stats()
    return stats


@app.get("/api/defects")
async def get_defects(limit: int = 50):
    defects = await db.get_recent_defects(limit)
    return defects


@app.get("/api/defects/today")
async def get_defects_today():
    defects = await db.get_today_defects()
    return defects


@app.get("/api/report")
async def get_quality_report(
    scope: str = "latest_session",
    roll_length_m: Optional[float] = None,
    fabric_price_per_m: Optional[float] = None,
    rework_cost_per_m: Optional[float] = None,
):
    all_defects = await db.get_all_defects(limit=2000)
    report = build_report_data(
        all_db_defects=all_defects,
        arduino_status=build_production_status(),
        scope=scope,
        configured_roll_length_m=roll_length_m,
        fabric_price_per_m=fabric_price_per_m,
        rework_cost_per_m=rework_cost_per_m,
        recent_evidence=state.recent_evidence,
    )
    return report


@app.get("/api/report/pdf")
async def download_quality_report_pdf(
    scope: str = "latest_session",
    roll_length_m: Optional[float] = None,
    fabric_price_per_m: Optional[float] = None,
    rework_cost_per_m: Optional[float] = None,
):
    all_defects = await db.get_all_defects(limit=2000)
    report = build_report_data(
        all_db_defects=all_defects,
        arduino_status=build_production_status(),
        scope=scope,
        configured_roll_length_m=roll_length_m,
        fabric_price_per_m=fabric_price_per_m,
        rework_cost_per_m=rework_cost_per_m,
        recent_evidence=state.recent_evidence,
    )
    pdf_bytes = generate_report_pdf_bytes(report)
    filename = f"{report['summary']['report_id']}_Weave_Kiran_Quality_Report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


# Serve the built React dashboard at `/` and all client-side routes when `app/dist` exists
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{frontend_path:path}", include_in_schema=False)
    async def serve_frontend(frontend_path: str):
        if frontend_path.startswith(("api/", "ws/")):
            raise HTTPException(status_code=404, detail="Not found")

        requested_file = (FRONTEND_DIST / frontend_path).resolve()
        try:
            requested_file.relative_to(FRONTEND_DIST.resolve())
        except ValueError:
            raise HTTPException(status_code=404, detail="Not found")
        if requested_file.is_file():
            return FileResponse(requested_file)

        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    def root():
        return {"status": "online", "service": "Fabric AI"}
