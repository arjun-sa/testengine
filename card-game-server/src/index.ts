import { createServer } from 'node:http';
import express from 'express';
import { GameWebSocketServer } from './server/WebSocketServer.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerGame } from './games/registry.js';
import { cardGameAdapter } from './games/card-game/adapter.js';
import { insuranceGameAdapter } from './games/insurance/adapter.js';

// Register available games
registerGame(cardGameAdapter);
registerGame(insuranceGameAdapter);

const app = express();

app.get('/health', (_req, res) => {
  const wsServer = (app as any).__wsServer as GameWebSocketServer | undefined;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    connections: wsServer?.getConnectionManager().size ?? 0,
    rooms: wsServer?.getLobbyManager().roomCount ?? 0,
  });
});

const server = createServer(app);
const wsServer = new GameWebSocketServer(server);
(app as any).__wsServer = wsServer;

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Game server started');
});
