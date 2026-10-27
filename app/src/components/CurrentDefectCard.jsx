import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import { ShieldCheck, Clock } from 'lucide-react';

const getDefectImage = (type) => {
  if (!type) return '/defects/clean.jpg';
  const t = String(type).toLowerCase();
  if (t.includes('warp') || t.includes('weft')) return '/defects/warp_weft.jpg';
  if (t.includes('stain')) return '/defects/stain.jpg';
  if (t.includes('hole')) return '/defects/hole.jpg';
  if (t.includes('thread')) return '/defects/thread.jpg';
  if (t.includes('knot')) return '/defects/knot.jpg';
  return '/defects/warp_weft.jpg';
};

const formatTime = (ts) => {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleTimeString([], { hour12: false });
  } catch {
    return String(ts);
  }
};

export default function CurrentDefectCard() {
  const { currentDefect } = useSimulation();

  // Only display defect if a genuine live detection is present from the backend
  const isDefect = !!currentDefect;

  const defectType = currentDefect ? currentDefect.type.toUpperCase() : 'NORMAL FABRIC';
  const confidenceVal = currentDefect ? `${(currentDefect.confidence * 100).toFixed(0)}%` : 'N/A';
  const severityVal = currentDefect ? (currentDefect.severity || 'LOW').toUpperCase() : 'NORMAL';
  const detectionTime = currentDefect ? formatTime(currentDefect.timestamp) : null;
  const previewImage = isDefect ? getDefectImage(currentDefect.type) : '/defects/clean.jpg';

  return (
    <div
      className={`bg-white rounded-2xl p-5 border flex flex-col justify-between shadow-xs transition-all duration-300 h-full ${
        isDefect
          ? 'border-red-200/70 bg-gradient-to-b from-red-50/20 to-white'
          : 'border-slate-100 bg-white'
      }`}
    >
      <div>
        {/* Card Header & Timestamp */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Current Status
          </h3>
          {detectionTime && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{detectionTime}</span>
            </div>
          )}
        </div>

        {/* Status Alert Text */}
        <div className="mt-1">
          {isDefect ? (
            <p className="text-base font-black text-red-600 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              DEFECT DETECTED
            </p>
          ) : (
            <p className="text-base font-black text-emerald-600 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              NO DEFECT DETECTED
            </p>
          )}
        </div>

        {/* Defect Pill */}
        <div className="my-3">
          {isDefect ? (
            <div className="bg-red-100/80 border border-red-200/60 text-red-600 font-black text-base md:text-lg tracking-wider py-2 px-4 rounded-xl text-center shadow-xs uppercase">
              {defectType}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm md:text-base tracking-wide py-2 px-4 rounded-xl text-center uppercase">
              NORMAL FABRIC
            </div>
          )}
        </div>

        {/* Cropped Preview Image */}
        <div className="relative w-full aspect-[16/10] bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-xs group">
          <img
            src={previewImage}
            alt={isDefect ? defectType : 'Inspected Fabric'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.target.src = isDefect ? '/defects/warp_weft.jpg' : '/defects/clean.jpg';
            }}
          />

          {/* Red Bounding Box on active defect preview */}
          {isDefect && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[45%] h-[65%] border-2 border-red-600 bg-red-500/10 rounded-xs shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse"></div>
            </div>
          )}

          {!isDefect && (
            <div className="absolute top-2 right-2 bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>NORMAL WEAVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Confidence & Severity Row */}
      <div className="pt-4 flex items-end justify-between border-t border-slate-100 mt-3">
        <div>
          <span className="text-xs font-semibold text-slate-400 block mb-0.5">
            Confidence
          </span>
          <span className="text-3xl font-black text-slate-900 tracking-tight leading-none font-sans">
            {confidenceVal}
          </span>
        </div>

        <div>
          {isDefect ? (
            <span
              className={`inline-block font-extrabold text-xs px-4 py-1.5 rounded-lg tracking-wider uppercase shadow-xs ${
                severityVal === 'HIGH'
                  ? 'bg-red-100 text-red-600 border border-red-200'
                  : severityVal === 'MEDIUM'
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              {severityVal}
            </span>
          ) : (
            <span className="inline-block bg-emerald-100 text-emerald-700 font-extrabold text-xs px-4 py-1.5 rounded-lg tracking-wider uppercase border border-emerald-200 shadow-xs">
              NORMAL
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
