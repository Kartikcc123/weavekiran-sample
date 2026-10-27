
#include <Servo.h>

// ---------------- PIN CONFIGURATION ----------------
const byte ENA = 5;
const byte IN1 = 8;
const byte IN2 = 9;

const byte ENB = 6;
const byte IN3 = 10;
const byte IN4 = 11;

const byte FABRIC_SENSOR_PIN = 2;
const byte SERVO_PIN = 4;

const byte TRIG_PIN = 12;
const byte ECHO_PIN = 7;

// ---------------- SERVO ----------------
Servo demoServo;

const int SERVO_CENTER = 90;
const int SERVO_RIGHT = 120;

int servoAngle = SERVO_CENTER;
int servoDirection = 1;

unsigned long lastServoMove = 0;
const unsigned long SERVO_INTERVAL_MS = 25;

// ---------------- FABRIC SENSOR ----------------
volatile unsigned long pulseCount = 0;
volatile unsigned long lastPulseMillis = 0;

unsigned long lastReportedPulses = 0;
unsigned long lastDataTime = 0;
unsigned long runStartPulseCount = 0;

const float PULSES_PER_METER = 100.0;

// Stop after no sensor pulses for this long,
// but only after the sensor has detected material.
const unsigned long MATERIAL_END_TIMEOUT_MS = 3000;

// ---------------- MOTOR ----------------
const int MOTOR_SPEED = 255;

bool motorRunning = false;
bool materialDetectedThisRun = false;

unsigned long motorStartTime = 0;

// ---------------- SERIAL BUFFER ----------------
String commandBuffer = "";
unsigned long lastCommandCharTime = 0;

const unsigned long COMMAND_IDLE_TIMEOUT_MS = 60;

// ---------------- SENSOR INTERRUPT ----------------
void countFabricPulse() {
  pulseCount++;
  lastPulseMillis = millis();
}

// ---------------- MOTOR FUNCTIONS ----------------
void stopMotors(const char* reason = "STOP") {
  // Disable motor outputs first.
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);

  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);

  motorRunning = false;
  materialDetectedThisRun = false;

  Serial.print("ACK,");
  Serial.println(reason);
  Serial.println("STATE,STOPPED");
}

void runForward() {
  // Stop outputs before changing direction.
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);

  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);

  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);

  analogWrite(ENA, MOTOR_SPEED);
  analogWrite(ENB, MOTOR_SPEED);

  noInterrupts();
  runStartPulseCount = pulseCount;
  interrupts();

  motorRunning = true;
  materialDetectedThisRun = false;
  motorStartTime = millis();

  Serial.println("ACK,START");
  Serial.println("STATE,RUNNING");
}

void runReverse() {
  // Stop outputs before changing direction.
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);

  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);

  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);

  analogWrite(ENA, MOTOR_SPEED);
  analogWrite(ENB, MOTOR_SPEED);

  noInterrupts();
  runStartPulseCount = pulseCount;
  interrupts();

  motorRunning = true;
  materialDetectedThisRun = false;
  motorStartTime = millis();

  Serial.println("ACK,RESET");
  Serial.println("STATE,RUNNING");
}

// ---------------- SERVO SHOWCASE ----------------
void updateServoShowcase() {
  unsigned long now = millis();

  if (now - lastServoMove < SERVO_INTERVAL_MS) {
    return;
  }

  lastServoMove = now;
  servoAngle += servoDirection;

  if (servoAngle >= SERVO_RIGHT) {
    servoAngle = SERVO_RIGHT;
    servoDirection = -1;
  } else if (servoAngle <= SERVO_CENTER) {
    servoAngle = SERVO_CENTER;
    servoDirection = 1;
  }

  demoServo.write(servoAngle);
}

// ---------------- SERIAL COMMAND HANDLER ----------------
void handleCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command.length() == 0) {
    return;
  }

  Serial.print("CMD,");
  Serial.println(command);

  if (command == "START") {
    runForward();
  }
  else if (command == "RESET") {
    noInterrupts();
    pulseCount = 0;
    lastPulseMillis = 0;
    interrupts();

    lastReportedPulses = 0;

    // Continuous reverse; no automatic 8-second timeout.
    runReverse();
  }
  else if (command == "STOP") {
    stopMotors("STOP");
  }
  else if (command == "STATUS") {
    noInterrupts();
    unsigned long pulses = pulseCount;
    interrupts();

    Serial.print("STATUS,MOTOR=");
    Serial.print(motorRunning ? "RUNNING" : "STOPPED");
    Serial.print(",PULSES=");
    Serial.println(pulses);
  }
  else if (command == "PING") {
    Serial.println("PONG");
  }
  else {
    Serial.println("ERR,UNKNOWN_COMMAND");
  }
}

// ---------------- NON-BLOCKING SERIAL READER ----------------
void readSerialCommands() {
  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (commandBuffer.length() > 0) {
        handleCommand(commandBuffer);
        commandBuffer = "";
      }
    } else if (commandBuffer.length() < 40) {
      commandBuffer += c;
      lastCommandCharTime = millis();
    }
  }

  // Accept commands even if the sender omits newline.
  if (commandBuffer.length() > 0 &&
      millis() - lastCommandCharTime >= COMMAND_IDLE_TIMEOUT_MS) {
    handleCommand(commandBuffer);
    commandBuffer = "";
  }
}

// ---------------- MATERIAL-OVER DETECTION ----------------
void checkMaterialEnd() {
  if (!motorRunning) {
    return;
  }

  unsigned long currentPulses;
  unsigned long lastPulse;

  noInterrupts();
  currentPulses = pulseCount;
  lastPulse = lastPulseMillis;
  interrupts();

  // Wait until the sensor detects material during this run.
  if (currentPulses > runStartPulseCount) {
    materialDetectedThisRun = true;
  }

  if (!materialDetectedThisRun) {
    return;
  }

  // If pulses stop for 3 seconds, assume material has ended.
  if (lastPulse != 0 &&
      millis() - lastPulse >= MATERIAL_END_TIMEOUT_MS) {
    stopMotors("MATERIAL_OVER");
  }
}

// ---------------- SENSOR DATA ----------------
void sendSensorData() {
  unsigned long now = millis();

  if (now - lastDataTime < 1000UL) {
    return;
  }

  unsigned long elapsed = now - lastDataTime;
  lastDataTime = now;

  noInterrupts();
  unsigned long currentPulses = pulseCount;
  interrupts();

  unsigned long newPulses = currentPulses - lastReportedPulses;
  lastReportedPulses = currentPulses;

  float meters = currentPulses / PULSES_PER_METER;
  float speedMPerMin =
      (newPulses / PULSES_PER_METER) * (60000.0 / elapsed);

  Serial.print("DATA,");
  Serial.print(meters, 3);
  Serial.print(",");
  Serial.println(speedMPerMin, 3);
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(9600);

  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);

  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  pinMode(FABRIC_SENSOR_PIN, INPUT_PULLUP);

  // Ultrasonic is connected for showcase only.
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  attachInterrupt(
    digitalPinToInterrupt(FABRIC_SENSOR_PIN),
    countFabricPulse,
    FALLING
  );

  demoServo.attach(SERVO_PIN);
  demoServo.write(SERVO_CENTER);

  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);

  motorRunning = false;

  lastServoMove = millis();
  lastDataTime = millis();

  Serial.println("WEAVE_KIRAN_READY");
  Serial.println("STATE,STOPPED");
}

// ---------------- MAIN LOOP ----------------
void loop() {
  updateServoShowcase();
  readSerialCommands();
  checkMaterialEnd();
  sendSensorData();
}
