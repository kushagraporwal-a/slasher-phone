export interface CursorPosition {
  x: number;
  y: number;
}

// Pixels of cursor velocity per (radian/second) of phone rotation rate.
// Tuned so a comfortable, deliberate wrist rotation sweeps the cursor
// across the canvas in well under a second. This is a relative "air
// mouse" model, not absolute pointing: the phone reports how fast it's
// rotating, and that rate is integrated into cursor velocity every frame
// — like an optical mouse, not a laser pointer. See MotionSensor.kt for
// why (a bare phone has no drift-free absolute reference to point with).
const VELOCITY_PX_PER_RAD_PER_SEC = 700;

/**
 * Integrates one frame of rotation-rate input into a new cursor position.
 * `dtSeconds` should be the real elapsed time since the last call — using
 * a fixed assumed interval would mis-scale movement whenever the frame
 * rate isn't perfectly steady.
 */
export function stepCursor(
  current: CursorPosition,
  yawRate: number,
  pitchRate: number,
  dtSeconds: number,
  canvasWidth: number,
  canvasHeight: number,
): CursorPosition {
  const dx = yawRate * VELOCITY_PX_PER_RAD_PER_SEC * dtSeconds;
  // Tipping the phone's top away from you (aiming up) should move the cursor up.
  const dy = -pitchRate * VELOCITY_PX_PER_RAD_PER_SEC * dtSeconds;

  return {
    x: Math.min(Math.max(current.x + dx, 0), canvasWidth),
    y: Math.min(Math.max(current.y + dy, 0), canvasHeight),
  };
}
