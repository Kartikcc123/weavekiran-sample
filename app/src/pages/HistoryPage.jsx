import React, { useState } from 'react';
import { Clock, Search, Filter, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { getDefectSwatch, SAMPLE_RECENT_INSPECTIONS } from '../utils/swatches';

export default function HistoryPage() {
  const { recentDetections } = useSimulation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');

  // Use real detections or backfill with sample inspections if empty
  const allDetections = (recentDetections && recentDetections.length > 0)
    ? recentDetections
    : SAMPLE_RECENT_INSPECTIONS.map(s => ({
        id: s.id,
        event_id: `DEF-SAMPLE-${s.id}`,
        timestamp: s.timestamp,
        type: s.type,
        confidence: s.confidence,
        severity: s.type === 'Good' ? 'LOW' : 'HIGH',
        fabricPosition: '14.2 m'
      }));

  // Filter items
  const filtered = allDetections.filter(item => {
    const matchesSearch =
      (item.type && item.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.event_id && item.event_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSeverity =
      selectedSeverity === 'ALL' || item.severity === selectedSeverity;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
            <Clock className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0F172A] tracking-tight">
              Inspection History & Defect Log
            </h1>
            <p className="text-xs text-[#64748B]">
              Comprehensive log of fabric defect events with timestamps and confidence scores
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search defect type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all w-48"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedSeverity === sev
                    ? 'bg-white text-[#EA580C] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#475569] font-bold uppercase tracking-wider border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3.5 px-4">Swatch</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4">Defect Type</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Fabric Position</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Event ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((item, idx) => {
                const timeStr = item.timestamp
                  ? new Date(item.timestamp).toLocaleTimeString([], { hour12: true })
                  : '10:24:16 AM';
                const swatch = getDefectSwatch(item.type);
                const confPct = `${Math.round((item.confidence || 0.85) * 100)}%`;

                let sevBadge = 'bg-gray-100 text-gray-700';
                if (item.severity === 'HIGH') sevBadge = 'bg-red-100 text-red-700';
                else if (item.severity === 'MEDIUM') sevBadge = 'bg-amber-100 text-amber-700';
                else if (item.severity === 'LOW') sevBadge = 'bg-emerald-100 text-emerald-700';

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                        <img src={swatch} alt={item.type} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{timeStr}</td>
                    <td className="py-3 px-4 font-bold text-[#0F172A]">{item.type}</td>
                    <td className="py-3 px-4 font-extrabold text-[#0F172A]">{confPct}</td>
                    <td className="py-3 px-4 text-slate-500">{item.fabricPosition || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${sevBadge}`}>
                        {item.severity || 'LOW'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {item.event_id || `DEF-${idx + 1}`}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-slate-600">No defect records found</p>
                    <p className="text-xs text-slate-400">Try adjusting your search or severity filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
