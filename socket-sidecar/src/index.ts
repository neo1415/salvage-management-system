import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authenticateSocket } from './auth.js';
import { emitInternalBroadcast, registerSocketHandlers } from './events.js';
import { internalBroadcastSchema } from './types.js';

const port = Number(process.env.PORT || 4001);
const appOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
const internalSecret = process.env.SOCKET_INTERNAL_SECRET;

const app = express();
const httpServer = createServer(app);
const broadcastRateLimits = new Map<string, number[]>();
const BROADCAST_LIMIT = Number(process.env.INTERNAL_BROADCAST_RATE_LIMIT || 120);
const BROADCAST_WINDOW_MS = 60_000;

app.use(
  cors({
    origin: appOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: '256kb' }));

const io = new Server(httpServer, {
  cors: {
    origin: appOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1024 * 1024,
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: false
  }
});

io.use(async (socket, next) => {
  try {
    const user = await authenticateSocket(socket);
    socket.data.user = user;
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error('Socket authentication failed'));
  }
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket as Parameters<typeof registerSocketHandlers>[1]);
});

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'nem-salvage-socket-sidecar',
    connectedSockets: io.engine.clientsCount,
    appOrigin,
    timestamp: new Date().toISOString()
  });
});

app.post('/internal/broadcast', (request, response) => {
  if (!internalSecret) {
    response.status(503).json({ error: 'Internal broadcast secret is not configured' });
    return;
  }

  const authorization = request.header('authorization');
  if (authorization !== `Bearer ${internalSecret}`) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recentRequests = (broadcastRateLimits.get(clientIp) || []).filter(
    (timestamp) => now - timestamp < BROADCAST_WINDOW_MS
  );
  if (recentRequests.length >= BROADCAST_LIMIT) {
    broadcastRateLimits.set(clientIp, recentRequests);
    response.status(429).json({ error: 'Too many broadcast requests' });
    return;
  }
  recentRequests.push(now);
  broadcastRateLimits.set(clientIp, recentRequests);

  const parsed = internalBroadcastSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: 'Invalid broadcast payload',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
    return;
  }

  emitInternalBroadcast(io, parsed.data);
  response.json({ ok: true });
});

httpServer.listen(port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Socket sidecar listening',
      port,
      appOrigin,
      requireDbUserCheck: process.env.REQUIRE_DB_USER_CHECK === 'true'
    })
  );
});
