import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { getDefectSwatch, SAMPLE_RECENT_INSPECTIONS } from '../utils/swatches';

export default function RecentInspectionGallery() {
  const { recentDetections } = useSimulation();

  // Map real detections into gallery cards
  const realCards = (recentDetections || []).slice(0, 6).map((d) => {
    const timeStr = d.timestamp
      ? new Date(d.timestamp).toLocaleTimeString([], { hour12: true })
      : '10:24:16 AM';
    const confPct = `${Math.round((d.confidence || 0.85) * 100)}%`;

    let badgeColor = 'bg-[#EF4444] text-white';
    const lowerType = String(d.type || '').toLowerCase();
    if (lowerType.includes('good') || lowerType.includes('normal')) {
      badgeColor = 'bg-[#10B981] text-white';
    } else if (lowerType.includes('thread') || lowerType.includes('warp') || lowerType.includes('weft')) {
      badgeColor = 'bg-[#2563EB] text-white';
    } else if (lowerType.includes('hole')) {
      badgeColor = 'bg-[#0284C7] text-white';
    }

    return {
      id: d.id || d.event_id,
      type: d.type || 'Defect',
      confidence: d.confidence,
      timeStr,
      confPct,
      image: getDefectSwatch(d.type),
      badgeColor
    };
  });

  // If we have fewer than 6 real detections, backfill with sample items to keep layout balanced
  const displayCards = [
    ...realCards,
    ...SAMPLE_RECENT_INSPECTIONS.slice(realCards.length, 6)
  ].slice(0, 6);

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center">
            <Clock className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold text-[#0F172A]">Recent Inspection</span>
        </div>

        <Link
          to="/history"
          className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:text-[#C2410C] transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Horizontal Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 overflow-x-auto pb-1">
        {displayCards.map((item, index) => (
          <div
            key={item.id || index}
            className="flex flex-col bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] overflow-hidden hover:shadow-md transition-all duration-200 group"
          >
            {/* Image Swatch with Pill Badge */}
            <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-200">
              <img
                src={item.image}
                alt={item.type}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              
              {/* Pill Badge at bottom-left */}
              <div className="absolute bottom-1.5 left-1.5 z-10">
                <span
                  className={`${item.badgeColor} text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs`}
                >
                  {item.type}
                </span>
              </div>
            </div>

            {/* Card Footer: Time on left, Confidence % on right */}
            <div className="px-2.5 py-2 flex items-center justify-between text-xs bg-white">
              <span className="font-mono text-[10px] font-semibold text-[#64748B]">
                {item.timeStr}
              </span>
              <span className="font-extrabold text-[#0F172A] text-xs">
                {item.confPct || `${Math.round(item.confidence * 100)}%`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
