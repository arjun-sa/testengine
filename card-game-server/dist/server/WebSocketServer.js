import { WebSocketServer as WSServer } from 'ws';
import { ConnectionManager } from './ConnectionManager.js';
import { MessageRouter } from './MessageRouter.js';
import { LobbyManager } from '../lobby/LobbyManager.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
export class GameWebSocketServer {
    wss;
    connectionManager;
    messageRouter;
    lobbyManager;
    constructor(server) {
        this.connectionManager = new ConnectionManager(config.maxConnectionsPerIp);
        this.lobbyManager = new LobbyManager(this.connectionManager, config.maxRooms);
        this.messageRouter = new MessageRouter(this.connectionManager, this.lobbyManager);
        this.wss = new WSServer({ noServer: true });
        server.on('upgrade', (req, socket, head) => {
            this.handleUpgrade(req, socket, head);
        });
        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
    }
    handleUpgrade(req, socket, head) {
        // Validate origin
        const origin = req.headers.origin;
        if (origin && config.allowedOrigins.length > 0) {
            if (!config.allowedOrigins.includes(origin)) {
                logger.warn({ origin }, 'Rejected connection: invalid origin');
                socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                socket.destroy();
                return;
            }
        }
        // Only accept connections to /ws path
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        if (url.pathname !== '/ws') {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
            return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit('connection', ws, req);
        });
    }
    handleConnection(ws, req) {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('session') ?? undefined;
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            req.socket.remoteAddress ??
            'unknown';
        const connection = this.connectionManager.addConnection(ws, ip, sessionId);
        if (!connection) {
            ws.close(1013, 'Too many connections');
            return;
        }
        // Send session ID to client
        ws.send(JSON.stringify({
            type: 'SESSION_ESTABLISHED',
            sessionId: connection.sessionId,
        }));
        // If reconnecting into a room, notify lobby
        if (connection.roomCode) {
            this.lobbyManager.handleReconnect(connection);
        }
        ws.on('message', (data) => {
            const raw = data.toString();
            this.messageRouter.handleRawMessage(connection, raw);
        });
        ws.on('close', () => {
            logger.info({ sessionId: connection.sessionId }, 'WebSocket closed');
            this.lobbyManager.handleDisconnect(connection);
        });
        ws.on('error', (err) => {
            logger.error({ sessionId: connection.sessionId, err: err.message }, 'WebSocket error');
        });
    }
    getConnectionManager() {
        return this.connectionManager;
    }
    getLobbyManager() {
        return this.lobbyManager;
    }
}
//# sourceMappingURL=WebSocketServer.js.map