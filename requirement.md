# Requirements - Phone Controlled Slashing Game (MVP)

## Objective

Build a working MVP where an Android phone controls a virtual laser
cursor on a laptop browser. Moving the phone moves the cursor. Passing
the cursor through shapes removes them and increases the score.

## Scope

Included: - Android application for motion input - React web application
for the game - Real-time communication between phone and laptop - Shape
spawning - Collision detection - Score tracking

Excluded: - User accounts - Multiplayer - Physics - Animations beyond
simple appearance/disappearance - Sound effects - Native desktop
application

## Technology

### Android

-   Kotlin
-   SensorManager
-   WebSocket client

### Web

-   React
-   HTML5 Canvas
-   WebSocket server/client

## Communication

-   Phone and laptop must be connected to the same Wi-Fi network.
-   Communication must use WebSockets.
-   Target update rate: 60 FPS.
-   Keep latency as low as possible.

## Calibration

-   Display a "Calibrate" button.
-   When pressed, the current phone orientation becomes the neutral
    position.
-   Cursor movement is calculated relative to this neutral orientation.

## Cursor

-   Render a virtual laser cursor inside the game canvas.
-   Do not move the operating system mouse cursor.
-   Cursor should move smoothly in all directions.
-   Clamp cursor inside the game area.

## Game Area

-   Fixed game canvas.
-   Display current score at the top.
-   Display laser cursor.
-   Display spawned shapes.

## Shapes

Supported shapes: - Circle - Square - Triangle

Rules: - Spawn at random positions. - Spawn every 500--800 ms. - Maximum
8 shapes on screen. - Each shape disappears automatically after 3
seconds if not cut.

## Collision

Each render frame: 1. Update cursor position. 2. Check cursor
intersection with every active shape. 3. If collision occurs: - Remove
the shape. - Increment score by 1.

No click or touch input is required.

## Game States

### Initial

-   Waiting for phone connection.

### Connected

-   Calibration available.

### Playing

-   Shapes spawn.
-   Cursor moves.
-   Score updates.

## UI

Display: - Connection status - Calibrate button - Current score - Game
canvas

## Acceptance Criteria

-   Phone successfully connects to the laptop.
-   Cursor follows phone movement with minimal latency.
-   Calibration correctly centers the cursor.
-   Shapes spawn continuously.
-   Cursor passing through a shape removes it.
-   Score increments correctly.
-   Maximum of 8 active shapes at any time.
-   Shapes expire after 3 seconds if not cut.
-   Game runs smoothly at approximately 60 FPS on a modern laptop
    browser.
