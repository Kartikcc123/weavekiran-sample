import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Maximize2, RefreshCw, AlertCircle, SwitchCamera, Server } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { API_BASE_URL } from '../config';

export default function LiveInspection() {
  const {
    wsStatus,
    production,
    backendStatus,
    frameDetections,
    frameSize,
    sendCameraFrame
  } = useSimulation();

  // 'browser' uses the visitor's laptop/phone camera (cloud-ready);
  // 'server' uses the backend /video MJPEG stream (local DroidCam fallback)
  const [cameraMode, setCameraMode] = useState('browser');
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState(false);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const streamRef = useRef(null);

  // Camera + AI inspection is always active regardless of Arduino motor state
  const isInspectionRunning = true;

  const stopBrowserCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startBrowserCamera = useCallback(async () => {
    stopBrowserCamera();
    setCameraError('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser camera requires HTTPS or localhost.');
      return;
    }

    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 960 },
            height: { ideal: 540 }
          },
          audio: false
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Please allow camera permission in your browser to inspect fabric.');
      setCameraReady(false);
    }
  }, [facingMode, stopBrowserCamera]);

  useEffect(() => {
    if (cameraMode === 'browser') {
      startBrowserCamera();
    } else {
      stopBrowserCamera();
    }
    return () => {
      stopBrowserCamera();
    };
  }, [cameraMode, facingMode, startBrowserCamera, stopBrowserCamera]);

  // Periodically send browser camera frames to cloud AI backend when inspection is running
  useEffect(() => {
    if (cameraMode !== 'browser' || !cameraReady || !isInspectionRunning || wsStatus !== 'ONLINE') {
      return;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      const capCanvas = captureCanvasRef.current;
      if (!video || !capCanvas || video.readyState < 2) return;

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const targetW = 640;
      const targetH = Math.round((vh / vw) * targetW) || 480;

      if (capCanvas.width !== targetW) capCanvas.width = targetW;
      if (capCanvas.height !== targetH) capCanvas.height = targetH;

      const ctx = capCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const dataUrl = capCanvas.toDataURL('image/jpeg', 0.72);
      sendCameraFrame(dataUrl);
    }, 180);

    return () => clearInterval(interval);
  }, [cameraMode, cameraReady, isInspectionRunning, wsStatus, sendCameraFrame]);

  // Draw live YOLO bounding boxes on overlay canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (cameraMode !== 'browser' || !video) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const displayW = video.clientWidth || 640;
    const displayH = video.clientHeight || 480;
    if (canvas.width !== displayW) canvas.width = displayW;
    if (canvas.height !== displayH) canvas.height = displayH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isInspectionRunning || !frameDetections || frameDetections.length === 0) {
      return;
    }

    const srcW = frameSize?.width || 640;
    const srcH = frameSize?.height || 480;

    // Calculate letterbox / object-contain offset inside video element
    const srcRatio = srcW / srcH;
    const dispRatio = displayW / displayH;
    let renderW = displayW;
    let renderH = displayH;
    let offsetX = 0;
    let offsetY = 0;

    if (dispRatio > srcRatio) {
      renderH = displayH;
      renderW = renderH * srcRatio;
      offsetX = (displayW - renderW) / 2;
    } else {
      renderW = displayW;
      renderH = renderW / srcRatio;
      offsetY = (displayH - renderH) / 2;
    }

    const scaleX = renderW / srcW;
    const scaleY = renderH / srcH;

    frameDetections.forEach(det => {
      const bbox = det.bbox;
      if (!bbox) return;

      const x1 = offsetX + bbox.x1 * scaleX;
      const y1 = offsetY + bbox.y1 * scaleY;
      const w = (bbox.x2 - bbox.x1) * scaleX;
      const h = (bbox.y2 - bbox.y1) * scaleY;

      const conf = det.confidence || 0;
      const color = conf >= 0.8 ? '#EF4444' : conf >= 0.6 ? '#F59E0B' : '#10B981';

      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x1, y1, w, h);

      // Label tag
      const label = `${det.class_name} ${Math.round(conf * 100)}%`;
      ctx.font = 'bold 12px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const tagY = Math.max(0, y1 - 22);

      ctx.fillStyle = color;
      ctx.fillRect(x1, tagY, textWidth + 12, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x1 + 6, tagY + 14);
    });
  }, [cameraMode, frameDetections, frameSize, isInspectionRunning]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error("Fullscreen error:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => {
        console.error("Exit fullscreen error:", err);
      });
      setIsFullscreen(false);
    }
  };

  const handleRefreshStream = () => {
    setStreamError(false);
    if (cameraMode === 'browser') {
      startBrowserCamera();
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div
      ref={containerRef}
      className={`bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex flex-col h-full min-h-[340px] ${
        isFullscreen ? 'p-6 bg-black' : ''
      }`}
    >
      {/* Hidden capture canvas for encoding frames */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center">
            <Camera className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold text-[#0F172A]">Live Camera Feed</span>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
            {wsStatus === 'ONLINE' && isInspectionRunning ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-bold text-[#10B981]">AI Active</span>
              </>
            ) : wsStatus === 'ONLINE' && !isInspectionRunning ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <span className="text-xs font-bold text-[#F59E0B]">Paused</span>
              </>
            ) : wsStatus === 'CONNECTING' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                <span className="text-xs font-bold text-[#F59E0B]">Connecting</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span className="text-xs font-bold text-[#EF4444]">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Action icons on right */}
        <div className="flex items-center gap-1.5">
          {cameraMode === 'browser' && (
            <button
              type="button"
              onClick={toggleFacingMode}
              title="Switch Front / Back Camera"
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#475569] bg-slate-100 hover:bg-slate-200 hover:text-[#0F172A] transition-colors flex items-center gap-1"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flip Cam</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCameraMode(prev => (prev === 'browser' ? 'server' : 'browser'))}
            title="Switch between Browser Camera and Local Server Camera"
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#475569] bg-slate-100 hover:bg-slate-200 hover:text-[#0F172A] transition-colors flex items-center gap-1"
          >
            <Server className="w-3.5 h-3.5" />
            <span>{cameraMode === 'browser' ? 'Device Cam' : 'Server Cam'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshStream}
            title="Refresh Camera Feed"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-gray-100 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="flex-1 relative bg-[#0F172A] rounded-xl overflow-hidden flex items-center justify-center border border-gray-200 shadow-inner min-h-[260px]">
        {cameraMode === 'browser' ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain select-none"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </>
        ) : (
          wsStatus === 'ONLINE' && !streamError && (
            <img
              src={`${API_BASE_URL}/video`}
              alt="Live Fabric Feed"
              className="w-full h-full object-contain select-none"
              onError={() => setStreamError(true)}
            />
          )
        )}

        {/* Paused badge when user clicks STOP */}
        {!isInspectionRunning && (cameraReady || cameraMode === 'server') && (
          <div className="absolute top-3 left-3 z-20 bg-red-600/90 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-md">
            INSPECTION STOPPED — Click START to resume
          </div>
        )}

        {/* Fallback View when Camera Permission Denied or Offline */}
        {((cameraMode === 'browser' && cameraError) ||
          (cameraMode === 'server' && (wsStatus !== 'ONLINE' || streamError))) && (
          <div className="absolute inset-0 bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center z-10">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(#FFF 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            />

            <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl max-w-sm flex flex-col items-center shadow-lg">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-[#EF4444] flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-base font-bold text-white mb-1 tracking-tight">
                {cameraMode === 'browser' ? 'CAMERA ACCESS REQUIRED' : 'SERVER CAMERA OFFLINE'}
              </h3>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                {cameraMode === 'browser'
                  ? cameraError
                  : 'Connect your DroidCam or switch to Device Cam to use your browser camera.'}
              </p>
              <button
                type="button"
                onClick={handleRefreshStream}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white text-xs font-bold hover:shadow-md transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
