import React, { useState } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function LoomStatusCard() {
  const { backendStatus, production, startLoom, stopLoom, resetSession } = useSimulation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isConnected = Boolean(
    production?.arduino_connected ??
    backendStatus?.arduino_connected ??
    false
  );
  const isRunning = Boolean(
    production?.loom_running ??
    backendStatus?.loom_running ??
    false
  );

  const runCommand = async (command) => {
    setError('');
    if (!isConnected) {
      setError('Arduino is not connected from your device');
      return;
    }
    setBusy(true);
    try {
      await command();
    } catch (err) {
      setError(err.message || 'Arduino is not connected from your device');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full w-full rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-xs">
      <div className="flex h-full flex-col justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => runCommand(startLoom)}
          disabled={busy}
          title="Start inspection"
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold tracking-wide text-white shadow-md transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            isRunning
              ? 'bg-emerald-600 ring-2 ring-emerald-300 hover:bg-emerald-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          <Play className="h-4 w-4 fill-white" />
          <span>START</span>
        </button>

        <button
          type="button"
          onClick={() => runCommand(stopLoom)}
          disabled={busy}
          title="Stop inspection"
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold tracking-wide text-white shadow-md transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            !isRunning
              ? 'bg-red-700 ring-2 ring-red-300'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          <Square className="h-4 w-4 fill-white" />
          <span>STOP</span>
        </button>

        <button
          type="button"
          onClick={() => runCommand(resetSession)}
          disabled={busy}
          title="Reset inspection session"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-extrabold tracking-wide text-slate-700 shadow-md transition-all duration-150 hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-4 w-4 text-slate-500" />
          <span>RESET</span>
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
