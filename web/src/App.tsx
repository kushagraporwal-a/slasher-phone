import { useCallback, useRef, useState } from 'react';
import { useMotionSocket } from './net/useMotionSocket';
import { GameCanvas } from './game/GameCanvas';
import type { GameState, MotionSample } from './game/types';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<GameState>('initial');
  const [score, setScore] = useState(0);
  const [phoneConnected, setPhoneConnected] = useState(false);

  const latestMotionRef = useRef<MotionSample | null>(null);
  const recenterRequestRef = useRef(false);

  const handleMotion = useCallback((yawRate: number, pitchRate: number, t: number) => {
    latestMotionRef.current = { yawRate, pitchRate, t };
  }, []);

  const handlePhoneStatus = useCallback((connected: boolean) => {
    setPhoneConnected(connected);
    if (!connected) {
      latestMotionRef.current = null;
      setGameState('initial');
    } else {
      setGameState((prev) => (prev === 'initial' ? 'connected' : prev));
    }
  }, []);

  const { serverConnected } = useMotionSocket({
    onMotion: handleMotion,
    onPhoneStatus: handlePhoneStatus,
  });

  const handleCalibrate = useCallback(() => {
    // "Calibrate" now means "recenter the cursor" — there's no absolute
    // angle to zero out in the relative air-mouse model (see
    // cursorMapping.ts), so this is purely a web-side reset.
    recenterRequestRef.current = true;
    setGameState((prev) => (prev === 'initial' ? prev : 'playing'));
  }, []);

  const statusLabel = !serverConnected
    ? 'Server unreachable'
    : !phoneConnected
      ? 'Waiting for phone…'
      : gameState === 'playing'
        ? 'Playing'
        : 'Phone connected';

  return (
    <div className="app">
      <header className="hud">
        <div className={`status status--${phoneConnected ? 'connected' : 'waiting'}`}>
          <span className="status-dot" />
          {statusLabel}
        </div>
        <button
          type="button"
          className="calibrate-button"
          disabled={!phoneConnected}
          onClick={handleCalibrate}
        >
          Calibrate
        </button>
        <div className="score">Score: {score}</div>
      </header>

      <GameCanvas
        gameState={gameState}
        latestMotionRef={latestMotionRef}
        recenterRequestRef={recenterRequestRef}
        onScoreChange={setScore}
      />
    </div>
  );
}

export default App;
