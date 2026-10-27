import React, { useState } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function LoomStatusCard() {
  const { backendStatus, production, startLoom, stopLoom, resetSession } = useSimulation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isConnected =
  backendStatus?.arduino_connected ??
  backendStatus?.connected ??
  production?.arduino_connected ??
  production?.connected ??
  false;
  const isRunning = backendStatus?.loom_running ?? production?.loom_running ?? false;

  const runCommand = async (command) => {
    setBusy(true);
    setError('');
    try {
      await command();
    } catch (err) {
      setError(err.message || 'Command failed');
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
          disabled={busy || !isConnected}
          title={!isConnected ? 'Arduino is not connected' : 'Start loom'}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-extrabold tracking-wide text-white shadow-md transition-all duration-150 hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>START</span>
        </button>

        <button
          type="button"
          onClick={() => runCommand(stopLoom)}
          disabled={busy || !isConnected}
          title={!isConnected ? 'Arduino is not connected' : 'Stop loom'}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-sm font-extrabold tracking-wide text-white shadow-md transition-all duration-150 hover:bg-red-700 active:scale-[0.98]"
        >
          <Square className="h-4 w-4 fill-white" />
          <span>STOP</span>
        </button>

        <button
          type="button"
          onClick={() => runCommand(resetSession)}
          disabled={busy}
          title="Reset inspection session"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-extrabold tracking-wide text-slate-700 shadow-md transition-all duration-150 hover:bg-slate-200 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4 text-slate-500" />
          <span>RESET</span>
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
