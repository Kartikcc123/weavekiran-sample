import React from 'react';
import { BarChart3, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function DefectSummary() {
  const { stats } = useSimulation();

  const totalDefects = stats?.totalDefects ?? 0;
  const majorDefects = stats?.majorDefects ?? 0;
  const defectCounts = stats?.defectCounts || {};

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#F1F5F9]">
        <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center">
          <BarChart3 className="w-4 h-4 stroke-[2.5]" />
        </div>
        <h2 className="text-sm font-bold text-[#0F172A]">TODAY'S DEFECT SUMMARY</h2>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {/* Simple Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/70 text-center">
            <div className="text-2xl font-black text-[#0F172A]">{totalDefects}</div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">
              Total Defects
            </div>
          </div>
          <div className="border border-red-100 rounded-xl p-3 bg-red-50/60 text-center">
            <div className="text-2xl font-black text-[#EF4444]">{majorDefects}</div>
            <div className="text-[11px] font-bold text-[#EF4444] uppercase tracking-wider mt-0.5">
              Major Defects
            </div>
          </div>
          <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/70 text-center">
            <div className="text-2xl font-black text-[#0F172A]">Grade A</div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">
              Quality Grade
            </div>
          </div>
          <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/70 text-center">
            <div className="text-2xl font-black text-[#10B981]">98.2%</div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">
              Quality Score
            </div>
          </div>
        </div>

        {/* Defect Distribution Bars */}
        <div className="flex-1 flex flex-col gap-2 pt-2">
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
            Defect Distribution
          </h3>
          {Object.entries(defectCounts).length > 0 ? (
            Object.entries(defectCounts).map(([typeName, count], i) => {
              const max = Math.max(...Object.values(defectCounts), 1);
              const percentage = (count / max) * 100;
              return (
                <div key={i} className="flex items-center text-xs">
                  <div className="w-24 text-[#475569] font-medium truncate">{typeName}</div>
                  <div className="flex-1 h-3.5 bg-slate-100 rounded-full mx-2 relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#EA580C] to-[#EF4444] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(8, percentage)}%` }}
                    />
                  </div>
                  <div className="w-8 text-right font-black text-[#0F172A]">{count}</div>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-xs text-[#94A3B8]">
              No defect distribution data yet for this session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
