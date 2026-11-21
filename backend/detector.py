import os
from dotenv import load_dotenv
from ultralytics import YOLO

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

model = YOLO(MODEL_PATH)

CLASS_NAMES = model.names

# Watermark exclusion filter configuration (for DroidCam free watermark "using droidcam.app")
WATERMARK_FILTER_ENABLED = os.getenv("WATERMARK_FILTER_ENABLED", "true").lower() in ("true", "1", "yes")


def is_watermark_artifact(x1, y1, x2, y2, frame):
    """
    Intelligent filter to detect DroidCam watermark false positives:
    1. Black/Dark frame (camera idle/covered) -> all detections are screensaver artifacts
    2. Wide text banner detection (aspect ratio > 3.8, width > 22%, height < 16%)
    3. Individual watermark letter detections with high-contrast text in DroidCam drift band
    """
    if not WATERMARK_FILTER_ENABLED:
        return False

    frame_h, frame_w = frame.shape[:2]
    if frame_h <= 0 or frame_w <= 0:
        return False

    box_w = x2 - x1
    box_h = y2 - y1
    if box_w <= 0 or box_h <= 0:
        return False

    # 1. Dark/idle frame: if camera sensor is covered or DroidCam is idling
    # (mean pixel intensity < 15), there is no fabric under inspection.
    if frame.mean() < 15.0:
        return True

    aspect_ratio = box_w / float(box_h)
    rel_w = box_w / float(frame_w)
    rel_h = box_h / float(frame_h)
    cy = ((y1 + y2) / 2.0) / float(frame_h)

    # 2. Entire watermark banner ("using droidcam.app"):
    # DroidCam watermark has an extreme text aspect ratio (~7:1 to 9:1),
    # spans 22% - 60% of the screen width, and is very thin (< 16% height).
    if aspect_ratio >= 3.8 and rel_w >= 0.22 and rel_h <= 0.16:
        return True

    # 3. Individual letters or word fragments inside DroidCam's vertical drift band (25% - 75%)
    if 0.25 <= cy <= 0.75 and rel_h <= 0.08 and aspect_ratio >= 1.5:
        patch = frame[max(0, y1):min(frame_h, y2), max(0, x1):min(frame_w, x2)]
        if patch.size > 0:
            import cv2
            import numpy as np
            gray_patch = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
            # DroidCam font has bright white pixels (> 210) with sharp edges
            if np.mean(gray_patch > 210) > 0.08:
                return True

    return False


def detect(frame, confidence=0.35):
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

        # Exclude DroidCam watermark false positives
        if is_watermark_artifact(x1, y1, x2, y2, frame):
            continue

        detections.append({
            "class_id": class_id,
            "class_name": CLASS_NAMES[class_id],
            "confidence": round(conf, 3),
            "bbox": {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            }
        })

    return detections