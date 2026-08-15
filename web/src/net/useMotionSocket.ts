import { useEffect, useRef, useState } from 'react';
import type { ServerToWebMessage, WebHelloMessage } from './protocol';

const RECONNECT_DELAY_MS = 1500;
const WS_PORT = import.meta.env.VITE_WS_PORT ?? '8080';

interface Handlers {
  onMotion: (yawRate: number, pitchRate: number, t: number) => void;
  onPhoneStatus: (connected: boolean) => void;
}

export function useMotionSocket(handlers: Handlers): { serverConnected: boolean } {
  const [serverConnected, setServerConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const url = `ws://${window.location.hostname}:${WS_PORT}`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        setServerConnected(true);
        const hello: WebHelloMessage = { type: 'hello', role: 'web' };
        socket?.send(JSON.stringify(hello));
      };

      socket.onmessage = (event) => {
        let message: ServerToWebMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'motion') {
          handlersRef.current.onMotion(message.yawRate, message.pitchRate, message.t);
        } else if (message.type === 'phone_status') {
          handlersRef.current.onPhoneStatus(message.connected);
        }
      };

      socket.onclose = () => {
        setServerConnected(false);
        handlersRef.current.onPhoneStatus(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return { serverConnected };
}
