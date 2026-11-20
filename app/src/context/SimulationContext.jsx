import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL, WS_URL } from '../config';

const SimulationContext = createContext();

export function SimulationProvider({ children }) {
  // Session Stats
  const [stats, setStats] = useState({
    totalDefects: 0,
    majorDefects: 0,
    defectCounts: {}
  });

  // Production / Backend Status
  const [backendStatus, setBackendStatus] = useState(null);

  // Live production & inspection state
  const [production, setProduction] = useState({
    arduino_connected: false,
    fabric_speed: null,
    fabric_inspected: null,
    loom_running: false
  });

  // Live Events & Bounding Boxes
  const [recentDetections, setRecentDetections] = useState([]);
  const [currentDefect, setCurrentDefect] = useState(null);
  const [frameDetections, setFrameDetections] = useState([]);
  const [frameSize, setFrameSize] = useState({ width: 640, height: 480 });
  const [awaitingFrameAck, setAwaitingFrameAck] = useState(false);

  // Connection states
  const [wsStatus, setWsStatus] = useState('CONNECTING'); // CONNECTING, ONLINE, OFFLINE
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const ackTimerRef = useRef(null);

  const playAlertBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Ignore browser autoplay restrictions before first click
    }
  }, []);

  // 1. Fetch initial status & stats
  const fetchInitialData = async () => {
    try {
      const resStatus = await fetch(`${API_BASE_URL}/status`);
      if (resStatus.ok) {
        const statusData = await resStatus.json();
        setBackendStatus(statusData);
        setProduction(prev => ({
          ...prev,
          arduino_connected: Boolean(statusData.arduino_connected),
          fabric_speed: statusData.fabric_speed ?? prev.fabric_speed,
          fabric_inspected: statusData.fabric_inspected ?? prev.fabric_inspected,
          loom_running: Boolean(statusData.loom_running)
        }));
      }

      const resStats = await fetch(`${API_BASE_URL}/stats`);
      if (resStats.ok) {
        const data = await resStats.json();
        setStats({
          totalDefects: data.total_defects,
          majorDefects: data.major_defects,
          defectCounts: data.defect_counts
        });
      }

      const resHistory = await fetch(`${API_BASE_URL}/api/defects?limit=50`);
      if (resHistory.ok) {
        const historyData = await resHistory.json();
        const mappedHistory = historyData.map(e => ({
          id: e.track_id,
          event_id: e.event_id,
          timestamp: e.timestamp,
          type: e.defect_type,
          confidence: e.confidence,
          severity: e.severity,
          fabricPosition: e.fabric_position != null ? `${e.fabric_position} m` : '—'
        }));
        setRecentDetections(mappedHistory);
      }
    } catch (err) {
      console.error("Backend offline or inaccessible:", err);
    }
  };

  // 2. Manage WebSocket Connection
  useEffect(() => {
    fetchInitialData();

    let reconnectTimeout = null;

    const connectWebSocket = () => {
      setWsStatus('CONNECTING');
      const ws = new WebSocket(`${WS_URL}/ws/detections`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('ONLINE');
        setAwaitingFrameAck(false);
        console.log("[WS] Connected");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setAwaitingFrameAck(false);
          if (ackTimerRef.current) {
            clearTimeout(ackTimerRef.current);
            ackTimerRef.current = null;
          }

          if (payload.frame_size) {
            setFrameSize(payload.frame_size);
          }
          if (Array.isArray(payload.frame_detections)) {
            setFrameDetections(payload.frame_detections);
          }

          // Update stats from the payload
          if (payload.stats) {
            setStats({
              totalDefects: payload.stats.total_defects,
              majorDefects: payload.stats.major_defects,
              defectCounts: payload.stats.defect_counts
            });
          }

          // Update production data (Arduino + Inspection status)
          if (payload.production) {
            setProduction(payload.production);
            setBackendStatus(prev => prev ? {
              ...prev,
              ...payload.production
            } : payload.production);
          }

          // Handle NEW events (adding brand new rows to recent detections)
          if (payload.new_events && payload.new_events.length > 0) {
            const timestampStr = payload.timestamp;

            const shouldBeep = payload.new_events.some(e => (e.confidence || 0) >= 0.35);
            if (shouldBeep) {
              playAlertBeep();
            }

            const newRows = payload.new_events.map(e => ({
              id: e.track_id,
              event_id: e.event_id,
              timestamp: e.timestamp || timestampStr,
              type: e.defect_type || e.class_name,
              confidence: e.confidence,
              severity: e.severity,
              fabricPosition: e.fabric_position != null ? `${e.fabric_position} m` : '—'
            }));

            setRecentDetections(curr => {
              const updated = [...newRows, ...curr];
              return updated.slice(0, 50);
            });
          }

          // Handle CURRENT events (updates max confidence of existing rows + Current Defect panel)
          if (payload.current_detections) {
            if (payload.current_detections.length > 0) {
              setRecentDetections(curr => {
                let changed = false;
                const next = curr.map(row => {
                  const update = payload.current_detections.find(d => d.track_id === row.id);
                  if (update && update.confidence > row.confidence) {
                    changed = true;
                    return { ...row, confidence: update.confidence, severity: update.severity };
                  }
                  return row;
                });
                return changed ? next : curr;
              });

              const maxDet = payload.current_detections.reduce((prev, curr) =>
                prev.confidence > curr.confidence ? prev : curr
              );

              if (maxDet && maxDet.class_name) {
                setCurrentDefect({
                  type: maxDet.class_name,
                  confidence: maxDet.confidence,
                  severity: maxDet.severity
                });
              } else {
                setCurrentDefect(null);
              }
            } else {
              setCurrentDefect(null);
            }
          }
        } catch (err) {
          console.error("WebSocket message parse error:", err);
        }
      };

      ws.onclose = () => {
        setWsStatus('OFFLINE');
        setCurrentDefect(null);
        setFrameDetections([]);
        setAwaitingFrameAck(false);
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {};
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [playAlertBeep]);

  const sendCameraFrame = useCallback((dataUrl) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (awaitingFrameAck) return false;

    try {
      setAwaitingFrameAck(true);
      ws.send(JSON.stringify({ type: 'frame', image: dataUrl }));
      ackTimerRef.current = setTimeout(() => {
        setAwaitingFrameAck(false);
      }, 1500);
      return true;
    } catch {
      setAwaitingFrameAck(false);
      return false;
    }
  }, [awaitingFrameAck]);

  const resetSession = async () => {
    const res = await fetch(`${API_BASE_URL}/api/reset`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Arduino is not connected from your device');
    }
    setStats({ totalDefects: 0, majorDefects: 0, defectCounts: {} });
    setCurrentDefect(null);
    setFrameDetections([]);
    setProduction(prev => ({ ...prev, ...data }));
    setBackendStatus(prev => prev ? { ...prev, ...data } : data);
    return data;
  };

  const sendLoomCommand = async (command) => {
    const res = await fetch(`${API_BASE_URL}/api/loom/${command}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Arduino is not connected from your device');
    }
    setProduction(prev => ({ ...prev, ...data }));
    setBackendStatus(prev => prev ? { ...prev, ...data } : data);
    return data;
  };

  const startLoom = () => sendLoomCommand('start');
  const stopLoom = () => sendLoomCommand('stop');

  return (
    <SimulationContext.Provider value={{
      stats,
      backendStatus,
      production,
      recentDetections,
      currentDefect,
      frameDetections,
      frameSize,
      wsStatus,
      sendCameraFrame,
      resetSession,
      startLoom,
      stopLoom
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  return useContext(SimulationContext);
}
