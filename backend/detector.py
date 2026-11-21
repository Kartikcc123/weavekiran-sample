import os
import threading
from dotenv import load_dotenv

load_dotenv()

# Look for best.pt in project root first, then env var, then fallback
_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LOCAL_MODEL = os.path.join(_ROOT_DIR, "best.pt")

if os.path.exists(_LOCAL_MODEL):
    MODEL_PATH = _LOCAL_MODEL
elif os.path.exists(r"F:\Weave-kiran\best.pt"):
    MODEL_PATH = r"F:\Weave-kiran\best.pt"
elif os.path.exists(r"D:\Weave-kiran\best.pt"):
    MODEL_PATH = r"D:\Weave-kiran\best.pt"
else:
    MODEL_PATH = os.getenv("MODEL_PATH", "best.pt")

_model = None
_model_lock = threading.Lock()

DEFAULT_CLASS_NAMES = {
    0: "Stain",
    1: "Thread",
    2: "Warp_Weft",
    3: "hole",
    4: "seam",
}

# Watermark exclusion filter configuration (for DroidCam free watermark "using droidcam.app")
WATERMARK_FILTER_ENABLED = os.getenv("WATERMARK_FILTER_ENABLED", "true").lower() in ("true", "1", "yes")


def get_model():
    """Lazy-load YOLO model after uvicorn binds the port to prevent cloud startup 503 timeouts & save RAM."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                import torch
                from ultralytics import YOLO
                torch.set_num_threads(max(1, min(2, os.cpu_count() or 1)))
                print(f"[YOLO] Loading model from {MODEL_PATH}...")
                _model = YOLO(MODEL_PATH)
                print("[YOLO] Model loaded successfully.")
    return _model


def is_watermark_artifact(x1, y1, x2, y2, frame):
    if not WATERMARK_FILTER_ENABLED:
        return False

    frame_h, frame_w = frame.shape[:2]
    if frame_h <= 0 or frame_w <= 0:
        return False

    box_w = x2 - x1
    box_h = y2 - y1
    if box_w <= 0 or box_h <= 0:
        return False

    if frame.mean() < 15.0:
        return True

    aspect_ratio = box_w / float(box_h)
    rel_w = box_w / float(frame_w)
    rel_h = box_h / float(frame_h)
    cy = ((y1 + y2) / 2.0) / float(frame_h)

    if aspect_ratio >= 3.8 and rel_w >= 0.22 and rel_h <= 0.16:
        return True

    if 0.25 <= cy <= 0.75 and rel_h <= 0.08 and aspect_ratio >= 1.5:
        patch = frame[max(0, y1):min(frame_h, y2), max(0, x1):min(frame_w, x2)]
        if patch.size > 0:
            import cv2
            import numpy as np
            gray_patch = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
            if np.mean(gray_patch > 210) > 0.08:
                return True

    return False


def detect(frame, confidence=0.35):
    model = get_model()
    class_names = getattr(model, "names", DEFAULT_CLASS_NAMES)

    results = model.predict(
        source=frame,
        conf=confidence,
        imgsz=640,
        device="cpu",
        verbose=False
    )

    result = results[0]
    detections = []

    for box in result.boxes:
        class_id = int(box.cls[0])
        conf = float(box.conf[0])

        x1, y1, x2, y2 = map(
            int,
            box.xyxy[0].tolist()
        )

        if is_watermark_artifact(x1, y1, x2, y2, frame):
            continue

        detections.append({
            "class_id": class_id,
            "class_name": class_names.get(class_id, str(class_id)) if isinstance(class_names, dict) else class_names[class_id],
            "confidence": round(conf, 3),
            "bbox": {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            }
        })

    return detections
