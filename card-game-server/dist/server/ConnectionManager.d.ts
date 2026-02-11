import { WebSocket } from 'ws';
import { ServerMessage } from '../shared/messages.js';
import { RateLimiter } from '../utils/rateLimiter.js';
export interface Connection {
    ws: WebSocket;
    sessionId: string;
    playerId: number | null;
    roomCode: string | null;
    playerName: string | null;
    rateLimiter: RateLimiter;
    ip: string;
    connectedAt: number;
}
export declare class ConnectionManager {
    private connections;
    private ipConnectionCounts;
    private maxConnectionsPerIp;
    constructor(maxConnectionsPerIp?: number);
    addConnection(ws: WebSocket, ip: string, sessionId?: string): Connection | null;
    removeConnection(sessionId: string): Connection | undefined;
    getConnection(sessionId: string): Connection | undefined;
    getConnectionByWs(ws: WebSocket): Connection | undefined;
    send(sessionId: string, message: ServerMessage): void;
    get size(): number;
}
//# sourceMappingURL=ConnectionManager.d.ts.map