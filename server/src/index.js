import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT) || 8080;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HELLO_TIMEOUT_MS = 5_000;

const wss = new WebSocketServer({ port: PORT });

/** @type {import('ws').WebSocket | null} */
let phoneSocket = null;

/** @type {Set<import('ws').WebSocket>} */
const webSockets = new Set();

function safeSend(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToWeb(payload) {
  for (const socket of webSockets) {
    safeSend(socket, payload);
  }
}

function handleHello(socket, message) {
  if (message.role === 'phone') {
    if (phoneSocket && phoneSocket !== socket) {
      // A new phone replaces whatever was previously connected.
      phoneSocket.terminate();
    }
    phoneSocket = socket;
    socket.role = 'phone';
    console.log('[server] phone connected');
    broadcastToWeb({ type: 'phone_status', connected: true });
  } else if (message.role === 'web') {
    webSockets.add(socket);
    socket.role = 'web';
    console.log('[server] web client connected');
    safeSend(socket, { type: 'phone_status', connected: phoneSocket !== null });
  } else {
    socket.close(1002, 'unknown role');
  }
}

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.role = null;

  const helloTimer = setTimeout(() => {
    if (socket.role === null) {
      socket.close(1002, 'no hello received');
    }
  }, HELLO_TIMEOUT_MS);

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed messages
    }

    if (message.type === 'hello') {
      handleHello(socket, message);
      clearTimeout(helloTimer);
      return;
    }

    if (socket.role === null) return; // must say hello first

    if (socket.role === 'phone' && message.type === 'motion') {
      broadcastToWeb({
        type: 'motion',
        yawRate: message.yawRate,
        pitchRate: message.pitchRate,
        t: message.t,
      });
    }
  });

  socket.on('close', () => {
    clearTimeout(helloTimer);
    if (socket.role === 'phone' && phoneSocket === socket) {
      phoneSocket = null;
      console.log('[server] phone disconnected');
      broadcastToWeb({ type: 'phone_status', connected: false });
    } else if (socket.role === 'web') {
      webSockets.delete(socket);
      console.log('[server] web client disconnected');
    }
  });

  socket.on('error', (err) => {
    console.error('[server] socket error:', err.message);
  });
});

// Detect and drop dead connections (e.g. phone walked out of Wi-Fi range).
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeat));

function printLanAddresses() {
  const interfaces = networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

console.log(`[server] listening on ws://0.0.0.0:${PORT}`);
const lanAddresses = printLanAddresses();
if (lanAddresses.length > 0) {
  console.log('[server] phone should connect to one of:');
  for (const address of lanAddresses) {
    console.log(`[server]   ws://${address}:${PORT}`);
  }
} else {
  console.log('[server] no LAN address found — make sure Wi-Fi is connected');
}
