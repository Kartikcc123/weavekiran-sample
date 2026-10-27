import React, { useState, useEffect } from 'react';
import { RotateCcw, Cpu, Clock, Menu } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import ResetSessionModal from './ResetSessionModal';

export default function Header({ onToggleSidebar }) {
  const { backendStatus, production, resetSession } = useSimulation();
  const [time, setTime] = useState(new Date());
  const [resetModalOpen, setResetModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isRunning = backendStatus?.loom_running === true;
  const isArduinoConnected = Boolean(production?.arduino_connected);

  return (
    <>
      <header className="h-14 bg-white border-b border-[#EBECEF] flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-20">
        {/* Left Section */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Mobile menu toggle */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Loom Identifier */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100/80 rounded-lg border border-slate-200">
            <span className="text-xs font-black tracking-wider text-[#0F172A]">
              {backendStatus?.loom_id || 'LOOM 01'}
            </span>
          </div>

          {/* Machine Running Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-[#10B981] animate-pulse' : 'bg-red-500'
              }`}
            />
            <span
              className={`text-xs font-black tracking-wide ${
                isRunning ? 'text-[#10B981]' : 'text-red-500'
              }`}
            >
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>

          {/* Arduino Status (Desktop) */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#64748B]">
            <Cpu className={`w-3.5 h-3.5 ${isArduinoConnected ? 'text-[#10B981]' : 'text-slate-400'}`} />
            <span className="font-semibold">
              {isArduinoConnected ? 'Arduino Sync' : 'Arduino Offline'}
            </span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 md:gap-5">
          {/* Reset Session Button */}
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-[#EA580C] hover:border-[#EA580C]/40 transition-all shadow-2xs"
            title="Reset defect session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Session</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Live Clock */}
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#334155] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>{time.toLocaleTimeString([], { hour12: true })}</span>
          </div>
        </div>
      </header>

      {/* Reset Confirmation Dialog */}
      <ResetSessionModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={resetSession}
      />
    </>
  );
}
