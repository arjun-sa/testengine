import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { LobbyManager } from '../../src/lobby/LobbyManager.js';
import { ConnectionManager, Connection } from '../../src/server/ConnectionManager.js';
import { ServerMessage } from '../../src/shared/messages.js';
import { RateLimiter } from '../../src/utils/rateLimiter.js';

function createMockWs(): WebSocket {
  const sent: string[] = [];
  return {
    readyState: WebSocket.OPEN,
    send: (data: string) => sent.push(data),
    close: () => {},
    __sent: sent,
  } as any;
}

function createMockConnection(sessionId: string): { connection: Connection; messages: ServerMessage[] } {
  const ws = createMockWs();
  const messages: ServerMessage[] = [];
  const originalSend = ws.send.bind(ws);
  ws.send = ((data: string) => {
    originalSend(data);
    messages.push(JSON.parse(data));
  }) as any;

  return {
    connection: {
      ws,
      sessionId,
      playerId: null,
      roomCode: null,
      playerName: null,
      rateLimiter: new RateLimiter(),
      ip: '127.0.0.1',
      connectedAt: Date.now(),
    },
    messages,
  };
}

describe('LobbyManager', () => {
  let connectionManager: ConnectionManager;
  let lobbyManager: LobbyManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager(20);
    lobbyManager = new LobbyManager(connectionManager, 100);

    // Override send to use mock WS directly
    connectionManager.send = (sessionId: string, message: ServerMessage) => {
      const conn = connectionManager.getConnection(sessionId);
      if (conn && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(message));
      }
    };
  });

  function addTestConnection(sessionId: string): { connection: Connection; messages: ServerMessage[] } {
    const { connection, messages } = createMockConnection(sessionId);
    // Register in connection manager
    (connectionManager as any).connections = (connectionManager as any).connections || new Map();
    (connectionManager as any).connections.set(sessionId, connection);
    return { connection, messages };
  }

  it('should create a room', () => {
    const { connection, messages } = addTestConnection('session-1');

    lobbyManager.createRoom(connection, 'Alice');

    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('ROOM_CREATED');
    expect((messages[0] as any).roomCode).toHaveLength(4);
    expect(connection.roomCode).toBe((messages[0] as any).roomCode);
    expect(connection.playerId).toBe(0);
  });

  it('should not create room if already in one', () => {
    const { connection, messages } = addTestConnection('session-1');
    lobbyManager.createRoom(connection, 'Alice');
    messages.length = 0;

    lobbyManager.createRoom(connection, 'Alice');

    expect(messages[0].type).toBe('ERROR');
    expect((messages[0] as any).message).toContain('Already in a room');
  });

  it('should allow joining a room', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;

    lobbyManager.joinRoom(joiner.connection, roomCode, 'Bob');

    expect(joiner.messages[0].type).toBe('ROOM_JOINED');
    expect((joiner.messages[0] as any).players.length).toBe(2);
    expect(joiner.connection.roomCode).toBe(roomCode);
  });

  it('should reject join with duplicate name', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;

    lobbyManager.joinRoom(joiner.connection, roomCode, 'Alice');

    expect(joiner.messages[0].type).toBe('ERROR');
    expect((joiner.messages[0] as any).code).toBe('NAME_TAKEN');
  });

  it('should reject join to nonexistent room', () => {
    const { connection, messages } = addTestConnection('session-1');
    lobbyManager.joinRoom(connection, 'ZZZZ', 'Alice');

    expect(messages[0].type).toBe('ERROR');
    expect((messages[0] as any).code).toBe('ROOM_NOT_FOUND');
  });

  it('should toggle ready status', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;
    lobbyManager.joinRoom(joiner.connection, roomCode, 'Bob');

    host.messages.length = 0;
    joiner.messages.length = 0;

    lobbyManager.setReady(joiner.connection, true);

    // Both should receive PLAYER_READY
    const hostReady = host.messages.find((m) => m.type === 'PLAYER_READY');
    expect(hostReady).toBeDefined();
    expect((hostReady as any).ready).toBe(true);
  });

  it('should reject start from non-host', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;
    lobbyManager.joinRoom(joiner.connection, roomCode, 'Bob');

    joiner.messages.length = 0;
    lobbyManager.startGame(joiner.connection);

    expect(joiner.messages[0].type).toBe('ERROR');
    expect((joiner.messages[0] as any).code).toBe('NOT_HOST');
  });

  it('should reject start without all ready', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;
    lobbyManager.joinRoom(joiner.connection, roomCode, 'Bob');

    lobbyManager.setReady(host.connection, true);
    // joiner not ready

    host.messages.length = 0;
    lobbyManager.startGame(host.connection);

    expect(host.messages[0].type).toBe('ERROR');
    expect((host.messages[0] as any).code).toBe('PLAYERS_NOT_READY');
  });

  it('should start game when all ready', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;
    lobbyManager.joinRoom(joiner.connection, roomCode, 'Bob');

    lobbyManager.setReady(host.connection, true);
    lobbyManager.setReady(joiner.connection, true);

    host.messages.length = 0;
    joiner.messages.length = 0;

    lobbyManager.startGame(host.connection);

    const hostStarted = host.messages.find((m) => m.type === 'GAME_STARTED');
    const joinerStarted = joiner.messages.find((m) => m.type === 'GAME_STARTED');
    expect(hostStarted).toBeDefined();
    expect(joinerStarted).toBeDefined();
  });

  it('should handle player leaving', () => {
    const host = addTestConnection('host');
    const joiner = addTestConnection('joiner');

    lobbyManager.createRoom(host.connection, 'Alice');
    const roomCode = (host.messages[0] as any).roomCode;
    lobbyManager.joinRoom(joiner.connection, roomCode, 'Bob');

    host.messages.length = 0;
    lobbyManager.leaveRoom(joiner.connection);

    const playerLeft = host.messages.find((m) => m.type === 'PLAYER_LEFT');
    expect(playerLeft).toBeDefined();
    expect(joiner.connection.roomCode).toBeNull();
  });
});
