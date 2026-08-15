import type { Shape } from './types';

export function isPointInShape(px: number, py: number, shape: Shape): boolean {
  const half = shape.size / 2;
  switch (shape.type) {
    case 'circle':
      return Math.hypot(px - shape.x, py - shape.y) <= half;
    case 'square':
      return Math.abs(px - shape.x) <= half && Math.abs(py - shape.y) <= half;
    case 'triangle':
      return isPointInTriangle(px, py, shape);
  }
}

// Equilateral-ish triangle pointing up, inscribed in the shape's bounding box.
function isPointInTriangle(px: number, py: number, shape: Shape): boolean {
  const half = shape.size / 2;
  const ax = shape.x;
  const ay = shape.y - half;
  const bx = shape.x - half;
  const by = shape.y + half;
  const cx = shape.x + half;
  const cy = shape.y + half;

  const sign = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);

  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

  return !(hasNeg && hasPos);
}
