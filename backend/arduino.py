"""
Arduino Uno link over USB Serial.

Protocol (newline-terminated text, 9600 baud):
  PC  -> Arduino : "START" = run Motor 1 clockwise immediately, start Motor 2
                   clockwise after 2 seconds, and stop both 10 seconds later
                   "STOP"  = stop both loom motors immediately
                   "STATUS" = request motor state
                   "RESET" = reset counter and reverse both motors at 35% for 8 seconds
  Arduino -> PC  : "READY"                           (sent once on boot)
                   "DATA,<meters>,<speed_m_per_min>" (sent every 1 second)
                   "STATE,RUNNING|STOPPED"

The link runs in its own thread, auto-detects the Arduino port (or uses
ARDUINO_PORT from .env), and reconnects automatically if the cable is
unplugged. If no Arduino is connected, the rest of the backend keeps working.
"""
import os
import threading
import time

import serial
import serial.tools.list_ports
from dotenv import load_dotenv

load_dotenv()

ARDUINO_PORT = os.getenv("ARDUINO_PORT", "").strip()      # e.g. COM5 (empty = auto-detect)
ARDUINO_BAUD = int(os.getenv("ARDUINO_BAUD", 9600))
ARDUINO_ENABLED = os.getenv("ARDUINO_ENABLED", "1") != "0"

# USB vendor IDs: Arduino LLC/SA, CH340 clones, FTDI, Silicon Labs CP210x
_KNOWN_VIDS = {0x2341, 0x2A03, 0x1A86, 0x0403, 0x10C4}


def _find_port():
    if ARDUINO_PORT:
        return ARDUINO_PORT
    for p in serial.tools.list_ports.comports():
        desc = (p.description or "").lower()
        if "bluetooth" in desc:
            continue
        if p.vid in _KNOWN_VIDS or "arduino" in desc or "ch340" in desc:
            return p.device
    return None


class ArduinoLink:
    def __init__(self):
        self._ser = None
        self._lock = threading.Lock()
        self._thread = None
        self._running = False

        self.connected = False
        self.port = None
        self.fabric_meters = None      # total fabric inspected (m), from Arduino
        self.fabric_speed = None       # m/min, from Arduino
        self.last_data_time = 0.0
        self.loom_running = False
        self.motor_state = "STOPPED"
        self.rounds_completed = 0
        self.last_round_time = None

    # ---------- lifecycle ----------
    def start(self):
        if not ARDUINO_ENABLED:
            print("[ARDUINO] Disabled via ARDUINO_ENABLED=0")
            return
        if self._thread and self._thread.is_alive():
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        self._close()

    # ---------- public API ----------
    def start_motor(self):
        if not self._send("START"):
            return False
        self.loom_running = True
        self.motor_state = "START_M1_CW_WAIT_M2"
        return True

    def stop_motor(self):
        was_running = self.loom_running
        if not self._send("STOP"):
            return False
        self.loom_running = False
        self.motor_state = "STOPPED"
        if was_running:
            self.rounds_completed += 1
            self.last_round_time = time.strftime("%I:%M:%S %p")
        return True

    def reset_motor(self):
        if not self._send("RESET"):
            return False
        self.loom_running = True
        self.motor_state = "RESET_BOTH_CCW"
        return True

    def status(self):
        fresh = (time.time() - self.last_data_time) < 5
        return {
            "arduino_connected": self.connected,
            "arduino_port": self.port,
            "fabric_speed": self.fabric_speed if fresh else None,
            "fabric_inspected": self.fabric_meters,
            "loom_running": self.loom_running,
            "motor_state": self.motor_state,
            "rounds_completed": self.rounds_completed,
            "last_round_time": self.last_round_time,
        }

    # ---------- internals ----------
    def _send(self, text):
        with self._lock:
            if not self._ser:
                return False
            try:
                self._ser.write((text + "\n").encode())
                self._ser.flush()
                print(f"[ARDUINO] -> {text}")
                return True
            except Exception as e:
                print(f"[ARDUINO] Write failed: {e}")
        self._close()
        return False

    def _close(self):
        with self._lock:
            if self._ser:
                try:
                    self._ser.close()
                except Exception:
                    pass
            self._ser = None
        if self.connected:
            print("[ARDUINO] Disconnected")
        self.connected = False

    def _connect(self):
        port = _find_port()
        if not port:
            return False
        try:
            ser = serial.Serial(port, ARDUINO_BAUD, timeout=0.15, write_timeout=1.0)
            time.sleep(2)  # Uno resets when the port opens; wait for bootloader
            ser.reset_input_buffer()
            with self._lock:
                self._ser = ser
            self.port = port
            self.connected = True
            print(f"[ARDUINO] Connected on {port} @ {ARDUINO_BAUD}")
            return True
        except Exception as e:
            print(f"[ARDUINO] Could not open {port}: {e}")
            return False

    def _handle_line(self, line):
        if line.startswith("DATA,"):
            parts = line.split(",")
            if len(parts) >= 3:
                try:
                    self.fabric_meters = round(float(parts[1]), 2)
                    self.fabric_speed = round(float(parts[2]), 2)
                    self.last_data_time = time.time()
                except ValueError:
                    pass
        elif line.startswith("ACK,MATERIAL_OVER"):
            if self.loom_running:
                self.rounds_completed += 1
                self.last_round_time = time.strftime("%I:%M:%S %p")
            self.loom_running = False
            self.motor_state = "STOPPED"
            print(f"[ARDUINO] <- {line} (Roller round completed)")
        elif line.startswith("STATE,"):
            was_running = self.loom_running
            motor_state = line.split(",", 1)[1]
            self.loom_running = motor_state in (
                "START_M1_CW_WAIT_M2",
                "START_BOTH_CW",
                "RESET_BOTH_CCW",
                "RUNNING",
            )
            if was_running and not self.loom_running:
                self.rounds_completed += 1
                self.last_round_time = time.strftime("%I:%M:%S %p")
            self.motor_state = motor_state
            print(f"[ARDUINO] <- {line}")
        elif line:
            print(f"[ARDUINO] <- {line}")

    def _run(self):
        warned = False
        while self._running:
            if not self._ser:
                if self._connect():
                    warned = False
                else:
                    if not warned:
                        print("[ARDUINO] Not found - retrying every 3s (backend keeps running)")
                        warned = True
                    time.sleep(3)
                    continue
            try:
                raw = b""
                with self._lock:
                    if self._ser and self._ser.in_waiting > 0:
                        raw = self._ser.readline()
                if raw:
                    self._handle_line(raw.decode(errors="ignore").strip())
                else:
                    time.sleep(0.03)
            except Exception as e:
                print(f"[ARDUINO] Read failed: {e}")
                self._close()
                time.sleep(1)


arduino = ArduinoLink()
