import React, { useState, useRef } from 'react';
import { Camera, Maximize2, RefreshCw, AlertCircle } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { API_BASE_URL } from '../config';

export default function LiveInspection() {
  const { wsStatus } = useSimulation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const containerRef = useRef(null);

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
  };

  return (
    <div
      ref={containerRef}
      className={`bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex flex-col h-full min-h-[340px] ${
        isFullscreen ? 'p-6 bg-black' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center">
            <Camera className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold text-[#0F172A]">Live Camera Feed</span>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
            {wsStatus === 'ONLINE' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-bold text-[#10B981]">Live</span>
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
        <div className="flex items-center gap-2">
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
        {wsStatus === 'ONLINE' && !streamError ? (
          <img
            src={`${API_BASE_URL}/video`}
            alt="Live Fabric Feed"
            className="w-full h-full object-contain select-none"
            onError={() => setStreamError(true)}
          />
        ) : null}

        {/* Fallback View when Offline or Error */}
        {(wsStatus !== 'ONLINE' || streamError) && (
          <div className="absolute inset-0 bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
            {/* Subtle tech grid background */}
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
                CAMERA FEED OFFLINE
              </h3>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Connect your DroidCam or USB inspection camera and verify the backend AI service is running.
              </p>
              <button
                type="button"
                onClick={handleRefreshStream}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white text-xs font-bold hover:shadow-md transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Video Stream</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
