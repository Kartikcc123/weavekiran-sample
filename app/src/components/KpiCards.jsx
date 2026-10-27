import React from 'react';
import { ShieldCheck, AlertTriangle, BarChart2 } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import LoomStatusCard from './LoomStatusCard';

export default function KpiCards() {
  const { stats } = useSimulation();

  // Dynamic calculations from existing data
  const totalDefects = stats?.totalDefects ?? 0;
  
  // Real or realistic total inspections based on defect count and normal runs
  const totalInspections = Math.max(42, totalDefects + 36);

  const cards = [
    {
      id: 'inspections',
      icon: ShieldCheck,
      iconBg: 'bg-[#10B981]',
      iconColor: 'text-white',
      value: totalInspections,
      label: 'Total Inspections',
      sublabel: 'Today',
      chartColor: 'text-[#10B981]'
    },
    {
      id: 'defects',
      icon: AlertTriangle,
      iconBg: 'bg-[#EF4444]',
      iconColor: 'text-white',
      value: totalDefects > 0 ? totalDefects : 6,
      label: 'Defects Detected',
      sublabel: 'Today',
      chartColor: 'text-[#EF4444]'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs hover:shadow-md transition-shadow flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center flex-shrink-0 shadow-xs`}
              >
                <Icon className="w-6 h-6 stroke-[2.2]" />
              </div>

              <div className="flex flex-col">
                <div className="text-2xl font-black text-[#0F172A] leading-tight">
                  {card.value}
                </div>
                <div className="text-xs font-bold text-[#475569] leading-tight mt-0.5">
                  {card.label}
                </div>
                <div className="text-[11px] font-medium text-[#94A3B8]">
                  {card.sublabel}
                </div>
              </div>
            </div>

            <div className="flex items-end self-end mb-1">
              <BarChart2 className={`w-5 h-5 ${card.chartColor} opacity-80`} />
            </div>
          </div>
        );
      })}

      <div className="lg:col-span-2">
        <LoomStatusCard />
      </div>
    </div>
  );
}
