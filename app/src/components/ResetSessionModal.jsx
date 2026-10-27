import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * In-app confirmation dialog for resetting the inspection session.
 * Replaces the native browser confirm()/alert() popups.
 * Phases: confirm -> resetting -> success | error
 */
export default function ResetSessionModal({ open, onClose, onConfirm }) {
  const [phase, setPhase] = useState('confirm');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleted, setDeleted] = useState(0);

  // Reset internal state whenever the modal opens
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setErrorMsg('');
      setDeleted(0);
    }
  }, [open]);

  // Close on Escape (not while a reset is in progress)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && phase !== 'resetting') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    setPhase('resetting');
    try {
      const data = await onConfirm();
      setDeleted(data?.deleted ?? 0);
      setPhase('success');
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err?.message?.includes('404')
          ? 'The backend does not have the reset feature yet. Please restart the backend server and try again.'
          : 'Could not reach the backend. Make sure the backend server is running and try again.'
      );
      setPhase('error');
    }
  };

  const busy = phase === 'resetting';

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div className="w-[420px] max-w-[92vw] bg-white rounded-lg shadow-2xl border border-[#E5E5E5] overflow-hidden animate-[popIn_180ms_ease-out]">
        {/* Header */}
        <div className={`px-5 py-3 flex items-center gap-3 border-b ${
          phase === 'success' ? 'bg-[#16A34A]/10 border-[#16A34A]/20'
          : 'bg-[#DC2626]/10 border-[#DC2626]/20'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
            phase === 'success' ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
          }`}>
            {phase === 'success' ? '✓' : '!'}
          </div>
          <h2 id="reset-modal-title" className="text-sm font-bold text-[#111111] uppercase tracking-wide">
            {phase === 'success' ? 'Session Reset Complete'
              : phase === 'error' ? 'Reset Failed'
              : 'Reset Inspection Session?'}
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 text-sm text-[#333333]">
          {(phase === 'confirm' || phase === 'resetting') && (
            <>
              <p className="mb-3">This will clear everything and start defect detection again from zero:</p>
              <ul className="space-y-1.5 mb-3">
                {[
                  'All defect counts (total, major, per type)',
                  'Recent defects list',
                  'Stored defect history in the database',
                  'Fabric inspected counter & inspection time',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#DC2626] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs font-bold text-[#DC2626]">This action cannot be undone.</p>
            </>
          )}

          {phase === 'success' && (
            <p>
              All activity has been cleared{deleted > 0 ? ` (${deleted} stored defect${deleted === 1 ? '' : 's'} removed)` : ''}.
              Detection is now running from the start.
            </p>
          )}

          {phase === 'error' && (
            <p className="text-[#DC2626]">{errorMsg}</p>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E5E5E5] flex justify-end gap-2">
          {(phase === 'confirm' || phase === 'resetting') && (
            <>
              <button
                id="reset-cancel-btn"
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 text-sm font-bold rounded border border-[#D4D4D4] text-[#333333] bg-white hover:bg-[#EFEFEF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                id="reset-confirm-btn"
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                autoFocus
                className="px-4 py-2 text-sm font-bold rounded bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors disabled:opacity-70 disabled:cursor-wait flex items-center gap-2"
              >
                {busy && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {busy ? 'Resetting…' : 'Confirm Reset'}
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <button
                id="reset-close-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold rounded border border-[#D4D4D4] text-[#333333] bg-white hover:bg-[#EFEFEF] transition-colors"
              >
                Close
              </button>
              <button
                id="reset-retry-btn"
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-bold rounded bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors"
              >
                Try Again
              </button>
            </>
          )}

          {phase === 'success' && (
            <button
              id="reset-done-btn"
              type="button"
              onClick={onClose}
              autoFocus
              className="px-4 py-2 text-sm font-bold rounded bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.95) translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>,
    document.body
  );
}
