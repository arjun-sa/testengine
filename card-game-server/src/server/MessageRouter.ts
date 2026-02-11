import { ClientMessage, ErrorCode } from '../shared/messages.js';
import { Connection, ConnectionManager } from './ConnectionManager.js';
import { validateMessage } from './MessageValidator.js';
import { LobbyManager } from '../lobby/LobbyManager.js';
import { logger } from '../utils/logger.js';

const MAX_PAYLOAD_BYTES = 1024;

export class MessageRouter {
  constructor(
    private connectionManager: ConnectionManager,
    private lobbyManager: LobbyManager
  ) {}

  handleRawMessage(connection: Connection, raw: string): void {
    // Payload size check
    if (Buffer.byteLength(raw, 'utf-8') > MAX_PAYLOAD_BYTES) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Message too large');
      return;
    }

    // Rate limiting
    if (!connection.rateLimiter.consume()) {
      this.sendError(connection, 'RATE_LIMITED', 'Too many messages');
      if (connection.rateLimiter.shouldDisconnect()) {
        logger.warn({ sessionId: connection.sessionId }, 'Rate limit disconnect');
        connection.ws.close(1008, 'Rate limited');
      }
      return;
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendError(connection, 'INVALID_MESSAGE', 'Invalid JSON');
      return;
    }

    // Validate schema
    const result = validateMessage(parsed);
    if (!result.ok) {
      this.sendError(connection, 'INVALID_MESSAGE', result.error);
      return;
    }

    this.routeMessage(connection, result.message);
  }

  private routeMessage(connection: Connection, message: ClientMessage): void {
    switch (message.type) {
      case 'PING':
        this.connectionManager.send(connection.sessionId, { type: 'PONG' });
        break;

      case 'CREATE_ROOM':
        this.lobbyManager.createRoom(connection, message.playerName);
        break;

      case 'JOIN_ROOM':
        this.lobbyManager.joinRoom(connection, message.roomCode, message.playerName);
        break;

      case 'LEAVE_ROOM':
        this.lobbyManager.leaveRoom(connection);
        break;

      case 'SET_READY':
        this.lobbyManager.setReady(connection, message.ready);
        break;

      case 'START_GAME':
        this.lobbyManager.startGame(connection);
        break;

      case 'SELECT_PAIR':
        this.lobbyManager.handleGameAction(connection, message);
        break;

      case 'CHOOSE_CARD':
        this.lobbyManager.handleGameAction(connection, message);
        break;

      case 'REQUEST_STATE':
        this.lobbyManager.handleGameAction(connection, message);
        break;
    }
  }

  private sendError(
    connection: Connection,
    code: ErrorCode,
    message: string
  ): void {
    this.connectionManager.send(connection.sessionId, {
      type: 'ERROR',
      code,
      message,
    });
  }
}
