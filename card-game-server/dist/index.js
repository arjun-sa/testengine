import { createServer } from 'node:http';
import express from 'express';
import { GameWebSocketServer } from './server/WebSocketServer.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
const app = express();
app.get('/health', (_req, res) => {
    const wsServer = app.__wsServer;
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        connections: wsServer?.getConnectionManager().size ?? 0,
        rooms: wsServer?.getLobbyManager().roomCount ?? 0,
    });
});
const server = createServer(app);
const wsServer = new GameWebSocketServer(server);
app.__wsServer = wsServer;
server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Card game server started');
});
//# sourceMappingURL=index.js.map