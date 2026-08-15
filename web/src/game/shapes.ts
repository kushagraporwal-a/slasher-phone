import type { Shape, ShapeType } from './types';

export const SHAPE_SIZE = 40;
export const MAX_SHAPES = 8;
export const SHAPE_LIFETIME_MS = 3000;
export const SPAWN_MIN_MS = 500;
export const SPAWN_MAX_MS = 800;

const SHAPE_TYPES: ShapeType[] = ['circle', 'square', 'triangle'];

let nextShapeId = 1;

export function createRandomShape(canvasWidth: number, canvasHeight: number, now: number): Shape {
  const half = SHAPE_SIZE / 2;
  const type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
  const x = half + Math.random() * (canvasWidth - SHAPE_SIZE);
  const y = half + Math.random() * (canvasHeight - SHAPE_SIZE);

  return { id: nextShapeId++, type, x, y, size: SHAPE_SIZE, spawnedAt: now };
}

export function randomSpawnDelay(): number {
  return SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
}
