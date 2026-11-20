# ---------- Stage 1: Build React Frontend ----------
FROM node:22-slim AS frontend-builder
WORKDIR /build/app

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app/ ./
RUN npm run build

# ---------- Stage 2: FastAPI + YOLO AI Runtime ----------
FROM python:3.10-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ARDUINO_ENABLED=0 \
    PORT=8080

# System libraries required by OpenCV / PyTorch on Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (keeps image fast & small for Cloud Run)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install Python requirements with headless OpenCV for cloud containers
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python opencv-python-headless && \
    pip install --no-cache-dir opencv-python-headless

# Copy YOLO model weights, backend source, and compiled frontend
COPY best.pt ./best.pt
COPY backend/ ./backend/
COPY --from=frontend-builder /build/app/dist ./app/dist

WORKDIR /app/backend
EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
