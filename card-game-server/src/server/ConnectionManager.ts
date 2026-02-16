import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { RateLimiter } from '../utils/rateLimiter.js';
import { logger } from '../utils/logger.js';

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

export class ConnectionManager {
  private connections = new Map<string, Connection>();
  private ipConnectionCounts = new Map<string, number>();
  private maxConnectionsPerIp: number;

  constructor(maxConnectionsPerIp: number = 20) {
    this.maxConnectionsPerIp = maxConnectionsPerIp;
  }

  addConnection(ws: WebSocket, ip: string, sessionId?: string): Connection | null {
    const currentCount = this.ipConnectionCounts.get(ip) ?? 0;
    if (currentCount >= this.maxConnectionsPerIp) {
      logger.warn({ ip }, 'Max connections per IP reached');
      return null;
    }

    // Check if this is a reconnection
    if (sessionId && this.connections.has(sessionId)) {
      const existing = this.connections.get(sessionId)!;
      // Close old socket if still open
      if (existing.ws.readyState === WebSocket.OPEN) {
        existing.ws.close(1000, 'Replaced by new connection');
      }
      // Decrement old IP count
      const oldIpCount = this.ipConnectionCounts.get(existing.ip) ?? 1;
      this.ipConnectionCounts.set(existing.ip, Math.max(0, oldIpCount - 1));

      existing.ws = ws;
      existing.ip = ip;
      existing.connectedAt = Date.now();

      this.ipConnectionCounts.set(ip, currentCount + 1);
      logger.info({ sessionId, ip }, 'Connection reconnected');
      return existing;
    }

    const newSessionId = sessionId ?? uuidv4();
    const connection: Connection = {
      ws,
      sessionId: newSessionId,
      playerId: null,
      roomCode: null,
      playerName: null,
      rateLimiter: new RateLimiter(),
      ip,
      connectedAt: Date.now(),
    };

    this.connections.set(newSessionId, connection);
    this.ipConnectionCounts.set(ip, currentCount + 1);
    logger.info({ sessionId: newSessionId, ip }, 'New connection');
    return connection;
  }

  removeConnection(sessionId: string): Connection | undefined {
    const conn = this.connections.get(sessionId);
    if (conn) {
      this.connections.delete(sessionId);
      const ipCount = this.ipConnectionCounts.get(conn.ip) ?? 1;
      this.ipConnectionCounts.set(conn.ip, Math.max(0, ipCount - 1));
      if ((this.ipConnectionCounts.get(conn.ip) ?? 0) <= 0) {
        this.ipConnectionCounts.delete(conn.ip);
      }
      logger.info({ sessionId }, 'Connection removed');
    }
    return conn;
  }

  getConnection(sessionId: string): Connection | undefined {
    return this.connections.get(sessionId);
  }

  getConnectionByWs(ws: WebSocket): Connection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.ws === ws) return conn;
    }
    return undefined;
  }

  send(sessionId: string, message: object): void {
    const conn = this.connections.get(sessionId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }

  get size(): number {
    return this.connections.size;
  }
}
