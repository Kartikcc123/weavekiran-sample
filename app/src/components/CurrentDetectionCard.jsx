import React from 'react';
import { Box, Clock, CheckCircle2 } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { getDefectSwatch } from '../utils/swatches';
import goodImg from '../assets/swatches/good.jpg';

export default function CurrentDetectionCard() {
  const { currentDefect, wsStatus } = useSimulation();

  // If a defect is actively detected
  const hasDefect = Boolean(currentDefect && currentDefect.type);

  const defectType = currentDefect?.type || 'Stain';
  const confidencePct = currentDefect?.confidence
    ? Math.round(currentDefect.confidence * 100)
    : 92;

  const nowTime = new Date().toLocaleTimeString([], { hour12: true });

  // Get matching defect swatch image
  const swatchImg = hasDefect ? getDefectSwatch(defectType) : goodImg;

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center">
            <Box className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold text-[#0F172A]">Current Detection</span>
        </div>

        {hasDefect ? (
          <span className="bg-[#EF4444] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs animate-pulse">
            DEFECT
          </span>
        ) : (
          <span className="bg-[#10B981] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            NORMAL
          </span>
        )}
      </div>

      {/* Main Body */}
      {hasDefect ? (
        <div className="flex items-center gap-4 mt-3">
          {/* Defect Preview Swatch */}
          <div className="w-20 h-20 md:w-22 md:h-22 rounded-xl border-2 border-red-200 overflow-hidden flex-shrink-0 shadow-xs relative group">
            <img
              src={swatchImg}
              alt={defectType}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl pointer-events-none" />
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="text-xl font-black text-[#0F172A] leading-tight truncate">
              {defectType}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475569] mt-1">
              <span>Confidence</span>
              <span className="text-[#EF4444] font-black text-sm">{confidencePct}%</span>
            </div>

            {/* Confidence Bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5 flex items-center">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#EF4444] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(15, confidencePct))}%` }}
              />
            </div>

            {/* Time Stamp */}
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#64748B] mt-2">
              <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Detected at {nowTime}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Normal State */
        <div className="flex items-center gap-4 mt-3">
          <div className="w-20 h-20 md:w-22 md:h-22 rounded-xl border-2 border-emerald-200 overflow-hidden flex-shrink-0 shadow-xs relative">
            <img
              src={goodImg}
              alt="Normal fabric"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 drop-shadow" />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="text-lg font-black text-[#0F172A] leading-tight">
              Good Fabric
            </div>
            <div className="text-xs font-bold text-[#10B981] mt-0.5">
              No Defect Detected
            </div>
            <div className="text-[11px] text-[#64748B] mt-1">
              Inspection operating with 100% quality pass rate.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
