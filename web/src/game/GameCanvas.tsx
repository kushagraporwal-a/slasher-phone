import { useEffect, useRef, type MutableRefObject } from 'react';
import type { GameState, MotionSample, Shape } from './types';
import { stepCursor, type CursorPosition } from './cursorMapping';
import { createRandomShape, randomSpawnDelay, MAX_SHAPES, SHAPE_LIFETIME_MS } from './shapes';
import { isPointInShape } from './collision';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

const CURSOR_RADIUS = 6;
const CENTER: CursorPosition = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

interface GameCanvasProps {
  gameState: GameState;
  latestMotionRef: MutableRefObject<MotionSample | null>;
  recenterRequestRef: MutableRefObject<boolean>;
  onScoreChange: (score: number) => void;
}

export function GameCanvas({
  gameState,
  latestMotionRef,
  recenterRequestRef,
  onScoreChange,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef(gameState);
  const shapesRef = useRef<Shape[]>([]);
  const scoreRef = useRef(0);
  const cursorRef = useRef<CursorPosition>({ ...CENTER });
  const lastFrameTimeRef = useRef<number | null>(null);
  const onScoreChangeRef = useRef(onScoreChange);
  onScoreChangeRef.current = onScoreChange;

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Reset score/shapes and (re)start the spawner whenever a fresh play
  // session begins (i.e. transitioning into 'playing'). Re-calibrating
  // while already playing does NOT re-trigger this — gameState stays
  // 'playing' in that case, so progress is preserved (it only requests a
  // recenter, handled in the main loop below).
  useEffect(() => {
    if (gameState !== 'playing') return;

    shapesRef.current = [];
    scoreRef.current = 0;
    onScoreChangeRef.current(0);
    cursorRef.current = { ...CENTER };

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleSpawn = () => {
      timeoutId = setTimeout(() => {
        if (shapesRef.current.length < MAX_SHAPES) {
          shapesRef.current = [
            ...shapesRef.current,
            createRandomShape(CANVAS_WIDTH, CANVAS_HEIGHT, performance.now()),
          ];
        }
        scheduleSpawn();
      }, randomSpawnDelay());
    };
    scheduleSpawn();

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  // Main render/update loop. Runs for the lifetime of the component and
  // reads everything through refs so it never needs to restart.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const frame = () => {
      const state = gameStateRef.current;
      const now = performance.now();
      const dtSeconds = lastFrameTimeRef.current === null ? 0 : (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      if (state === 'playing') {
        if (recenterRequestRef.current) {
          cursorRef.current = { ...CENTER };
          recenterRequestRef.current = false;
        }

        // 1. Update cursor position by integrating the latest rotation
        // rate — this is a relative "air mouse" model, not absolute
        // pointing (see cursorMapping.ts).
        const sample = latestMotionRef.current;
        if (sample && dtSeconds > 0) {
          cursorRef.current = stepCursor(
            cursorRef.current,
            sample.yawRate,
            sample.pitchRate,
            dtSeconds,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
          );
        }

        shapesRef.current = shapesRef.current.filter(
          (shape) => now - shape.spawnedAt <= SHAPE_LIFETIME_MS,
        );

        // 2 & 3. Check cursor intersection with every active shape; remove
        // hits and increment score.
        const cursor = cursorRef.current;
        let hits = 0;
        shapesRef.current = shapesRef.current.filter((shape) => {
          const hit = isPointInShape(cursor.x, cursor.y, shape);
          if (hit) hits += 1;
          return !hit;
        });
        if (hits > 0) {
          scoreRef.current += hits;
          onScoreChangeRef.current(scoreRef.current);
        }
      }

      draw(ctx, state, shapesRef.current, cursorRef.current);
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [latestMotionRef, recenterRequestRef]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="game-canvas"
    />
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  shapes: Shape[],
  cursor: { x: number; y: number },
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (state !== 'playing') {
    ctx.fillStyle = '#8892a6';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const message =
      state === 'initial' ? 'Waiting for phone connection…' : 'Press Calibrate to start';
    ctx.fillText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    return;
  }

  for (const shape of shapes) {
    drawShape(ctx, shape);
  }

  drawCursor(ctx, cursor);
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  const half = shape.size / 2;
  ctx.fillStyle = shapeColor(shape.type);
  ctx.beginPath();
  if (shape.type === 'circle') {
    ctx.arc(shape.x, shape.y, half, 0, Math.PI * 2);
  } else if (shape.type === 'square') {
    ctx.rect(shape.x - half, shape.y - half, shape.size, shape.size);
  } else {
    ctx.moveTo(shape.x, shape.y - half);
    ctx.lineTo(shape.x - half, shape.y + half);
    ctx.lineTo(shape.x + half, shape.y + half);
    ctx.closePath();
  }
  ctx.fill();
}

function shapeColor(type: Shape['type']): string {
  switch (type) {
    case 'circle':
      return '#38bdf8';
    case 'square':
      return '#34d399';
    case 'triangle':
      return '#fbbf24';
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, cursor: { x: number; y: number }) {
  const gradient = ctx.createRadialGradient(
    cursor.x,
    cursor.y,
    0,
    cursor.x,
    cursor.y,
    CURSOR_RADIUS * 4,
  );
  gradient.addColorStop(0, 'rgba(255,64,64,0.9)');
  gradient.addColorStop(1, 'rgba(255,64,64,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, CURSOR_RADIUS * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, CURSOR_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}
