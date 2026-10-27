import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Gauge, Ruler, Clock, Layers } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function ProductionStatus() {
  const { backendStatus, production } = useSimulation();
  
  // Calculate inspection runtime
  const [runtimeStr, setRuntimeStr] = useState("00:00:00");
  
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setRuntimeStr(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = backendStatus?.status === 'running';
  const isArduino = Boolean(production?.arduino_connected);

  const items = [
    {
      label: 'Loom Identifier',
      value: backendStatus?.loom_id || 'LOOM 01',
      icon: Activity,
      highlight: true
    },
    {
      label: 'Operation Status',
      value: isRunning ? 'RUNNING' : 'OFFLINE',
      icon: Activity,
      color: isRunning ? 'text-[#10B981]' : 'text-[#EF4444]'
    },
    {
      label: 'Arduino Controller',
      value: isArduino ? 'CONNECTED' : 'NOT CONNECTED',
      icon: Cpu,
      color: isArduino ? 'text-[#10B981]' : 'text-[#EF4444]'
    },
    {
      label: 'Fabric Speed',
      value: production?.fabric_speed != null ? `${production.fabric_speed.toFixed(2)} m/min` : 'N/A',
      icon: Gauge
    },
    {
      label: 'Fabric Inspected',
      value: production?.fabric_inspected != null ? `${production.fabric_inspected.toFixed(2)} m` : 'N/A',
      icon: Ruler
    },
    {
      label: 'Current Roll',
      value: backendStatus?.roll_id || 'ROLL-A01',
      icon: Layers
    },
    {
      label: 'Inspection Runtime',
      value: runtimeStr,
      icon: Clock,
      mono: true
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#F1F5F9]">
        <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center">
          <Activity className="w-4 h-4 stroke-[2.5]" />
        </div>
        <h2 className="text-sm font-bold text-[#0F172A]">CURRENT PRODUCTION STATUS</h2>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-2.5">
        {items.map((it, idx) => {
          const Icon = it.icon;
          return (
            <div
              key={idx}
              className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0 text-xs"
            >
              <div className="flex items-center gap-2 text-[#64748B] font-medium">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                <span>{it.label}:</span>
              </div>
              <span
                className={`font-bold ${it.color || 'text-[#0F172A]'} ${it.mono ? 'font-mono' : ''}`}
              >
                {it.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
