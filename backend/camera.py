import os
import cv2
from dotenv import load_dotenv

load_dotenv()

CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", 0))


def _is_cloud_environment() -> bool:
    # Google Cloud Run sets K_SERVICE; Render sets RENDER; Docker sets ARDUINO_ENABLED=0
    if os.getenv("K_SERVICE") or os.getenv("RENDER") or os.getenv("CLOUD_RUN_JOB"):
        return True
    if os.getenv("ARDUINO_ENABLED") == "0":
        return True
    return False


def init_camera():
    if _is_cloud_environment():
        print("[CAMERA] Cloud environment detected — using Browser Camera stream (skipping local USB VideoCapture).")
        return None

    print(f"[CAMERA] Attempting to open camera at index {CAMERA_INDEX}...")
    try:
        cam = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
        if not cam.isOpened():
            cam = cv2.VideoCapture(CAMERA_INDEX)

        if cam.isOpened():
            print(f"[CAMERA] Successfully opened camera at index {CAMERA_INDEX}")
            cam.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            return cam
    except Exception as e:
        print(f"[CAMERA] Warning: could not open local camera: {e}")

    print(f"[CAMERA] Local camera {CAMERA_INDEX} unavailable — falling back to Browser Camera stream.")
    return None


camera = init_camera()


def get_camera():
    return camera
