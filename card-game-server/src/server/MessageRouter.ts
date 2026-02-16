import { ErrorCode } from '../shared/messages.js';
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

    if (result.isLobby) {
      this.routeLobbyMessage(connection, result.message);
    } else {
      // Game action — delegate to lobby manager
      this.lobbyManager.handleGameAction(connection, result.message);
    }
  }

  private routeLobbyMessage(connection: Connection, message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'PING':
        this.connectionManager.send(connection.sessionId, { type: 'PONG' });
        break;

      case 'CREATE_ROOM':
        this.lobbyManager.createRoom(
          connection,
          message.playerName as string,
          (message.gameType as string | undefined) ?? 'card-game'
        );
        break;

      case 'JOIN_ROOM':
        this.lobbyManager.joinRoom(connection, message.roomCode as string, message.playerName as string);
        break;

      case 'LEAVE_ROOM':
        this.lobbyManager.leaveRoom(connection);
        break;

      case 'SET_READY':
        this.lobbyManager.setReady(connection, message.ready as boolean);
        break;

      case 'START_GAME':
        this.lobbyManager.startGame(connection);
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
