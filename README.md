# Slasher — Phone-Controlled Slashing Game (MVP)

An Android phone controls a laser cursor rendered in a React/Canvas game
running in a laptop browser. See [requirement.md](requirement.md) for the
original spec.

## How it works

```
Android phone  ──ws://<laptop-ip>:8080──▶  Node relay server  ◀──ws://localhost:8080──  React web app (browser)
 (orientation)                              (dumb relay)                                 (all game logic)
```

- The **server** is a thin WebSocket relay: it forwards orientation samples
  from the phone to the browser and tells the browser when the phone
  connects/disconnects. It has no game logic.
- The **web app** owns everything about the game: calibration, cursor
  mapping/smoothing, shape spawning, collision detection, and score.
- The **Android app** only reads the rotation-vector sensor and streams
  `{yaw, pitch}` samples at ~60Hz. It has no game logic and no Calibrate
  button — calibration happens on the web page.

Hold the phone **upright, like a remote/laser pointer aimed at the laptop
screen**. Turning it left/right moves the cursor horizontally; tilting it
up/down moves the cursor vertically.

## Prerequisites

- Node.js 18+
- The phone and laptop **on the same Wi-Fi network** (not a "client
  isolation" / guest network — some routers block device-to-device traffic
  on guest networks, which will prevent the phone from reaching the
  server).
- Android Studio (or just a JDK 17 + the Android SDK, already configured in
  `android/local.properties`) to build/install the APK.

## 1. Start the relay server

```bash
cd server
npm install
npm start
```

It prints the LAN IP address(es) to type into the Android app, e.g.:

```
[server] listening on ws://0.0.0.0:8080
[server] phone should connect to one of:
[server]   ws://192.168.1.23:8080
```

If your Mac firewall prompts to allow incoming connections for `node`,
allow it — otherwise the phone won't be able to reach the server.

## 2. Start the web app

```bash
cd web
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL in your laptop browser. It
connects to the relay server on `ws://localhost:8080` automatically — no
configuration needed here, since the browser and server run on the same
machine.

You should see **"Waiting for phone connection…"** on the canvas.

## 3. Build and install the Android app

```bash
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

(Or open the `android/` folder in Android Studio and hit Run.)

`android/local.properties` currently points at
`/Users/kushagraporwal/Library/Android/sdk`. If you build on a different
machine, delete that file and let Android Studio regenerate it, or edit the
`sdk.dir` path yourself.

## 4. Connect and play

1. Open the app on the phone, enter the laptop's LAN IP printed by the
   server (port `8080` is prefilled), and tap **Connect**.
2. The web page should switch to **"Phone connected"** and show "Press
   Calibrate to start".
3. Hold the phone comfortably pointed at the screen, then click
   **Calibrate** on the web page — that orientation becomes the neutral
   center. The game starts immediately.
4. Move the phone to slide the laser cursor through the shapes. Score goes
   up as shapes are cut.
5. You can press **Calibrate** again at any time to re-center without
   losing your score.

If the phone disconnects (app closed, Wi-Fi drops, etc.) the web app
automatically returns to the "Waiting for phone connection" state and
requires recalibration on reconnect.

## Project layout

```
server/   Node.js WebSocket relay (npm start)
web/      React + TypeScript + Vite game client (npm run dev / npm run build)
android/  Kotlin + Jetpack Compose controller app (./gradlew assembleDebug)
```

## Notes on what was NOT tested live

The Android app was verified to **build successfully** (`./gradlew
assembleDebug`) and the server/web app were verified to run and communicate
correctly (an automated smoke test drove the relay through hello/orientation
/connect/disconnect, and the web app was built + booted in dev mode). There
was no physical Android device available in this environment to install the
APK and verify the real sensor → cursor → collision flow end-to-end — please
do that on your device using the steps above.

## Design decisions / gaps filled in beyond the spec

The spec (`requirement.md`) is intentionally minimal. These choices fill
the gaps it leaves open:

- **Pairing**: no auto-discovery — the phone is told the laptop's IP
  manually (the server prints it on startup). Keeps the MVP simple.
- **Cursor mapping**: "pointer mode" — yaw drives X, pitch drives Y, using
  the rotation-vector sensor. Calibration re-centers both axes.
- **Connected → Playing transition**: pressing Calibrate while connected
  starts the game (resets score/shapes); pressing it again while already
  playing just re-centers without resetting progress.
- **Disconnect behavior**: any phone disconnect drops the web app back to
  the initial "waiting" state and clears shapes/score; reconnecting
  requires a fresh calibration.
- **Shape size/hit test**: fixed 40px shapes with point-based collision
  (not swept/radius-expanded) — simpler and reliable at 60fps.
- **Reliability**: both the phone and the browser auto-reconnect to the
  server if the connection drops; the server heartbeats every 30s to drop
  dead sockets (e.g. a phone that walked out of Wi-Fi range).
