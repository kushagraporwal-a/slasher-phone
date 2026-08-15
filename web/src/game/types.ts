export type ShapeType = 'circle' | 'square' | 'triangle';

export interface Shape {
  id: number;
  type: ShapeType;
  x: number;
  y: number;
  size: number;
  spawnedAt: number;
}

export type GameState = 'initial' | 'connected' | 'playing';

/** Phone rotation rate (radians/second), not an absolute angle. */
export interface MotionSample {
  yawRate: number;
  pitchRate: number;
  t: number;
}
