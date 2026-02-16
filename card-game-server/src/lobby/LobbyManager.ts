import { Room } from './Room.js';
import { generateRoomCode } from './RoomCodeGenerator.js';
import { Connection, ConnectionManager } from '../server/ConnectionManager.js';
import { getGameAdapter } from '../games/registry.js';
import { logger } from '../utils/logger.js';

export class LobbyManager {
  private rooms = new Map<string, Room>();

  constructor(
    private connectionManager: ConnectionManager,
    private maxRooms: number = 100
  ) {}

  createRoom(connection: Connection, playerName: string, gameType: string = 'card-game'): void {
    if (connection.roomCode) {
      this.sendError(connection, 'INVALID_ACTION', 'Already in a room');
      return;
    }

    if (this.rooms.size >= this.maxRooms) {
      this.sendError(connection, 'INVALID_ACTION', 'Server full, try again later');
      return;
    }

    const adapter = getGameAdapter(gameType);
    if (!adapter) {
      this.sendError(connection, 'INVALID_ACTION', `Unknown game type: ${gameType}`);
      return;
    }

    const existingCodes = new Set(this.rooms.keys());
    const code = generateRoomCode(existingCodes);

    const room = new Room(code, connection.sessionId, (roomCode) => {
      this.rooms.delete(roomCode);
      // Notify remaining connected players
      this.broadcastToRoom(roomCode, { type: 'ROOM_CLOSED', reason: 'Room expired' });
      logger.info({ roomCode }, 'Room destroyed');
    }, gameType);

    this.rooms.set(code, room);

    const player = room.addPlayer(connection.sessionId, playerName);
    if (!player) {
      this.rooms.delete(code);
      this.sendError(connection, 'INVALID_ACTION', 'Failed to create room');
      return;
    }

    connection.roomCode = code;
    connection.playerId = player.id;
    connection.playerName = playerName;

    this.connectionManager.send(connection.sessionId, {
      type: 'ROOM_CREATED',
      roomCode: code,
      playerId: player.id,
      gameType,
    });

    logger.info({ roomCode: code, sessionId: connection.sessionId, gameType }, 'Room created');
  }

  joinRoom(connection: Connection, roomCode: string, playerName: string): void {
    if (connection.roomCode) {
      this.sendError(connection, 'INVALID_ACTION', 'Already in a room');
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.sendError(connection, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    if (room.hasGame) {
      this.sendError(connection, 'INVALID_ACTION', 'Game already in progress');
      return;
    }

    if (room.playerCount >= 4) {
      this.sendError(connection, 'ROOM_FULL', 'Room is full');
      return;
    }

    // Check name uniqueness
    const existingNames = room.getPlayers().map((p) => p.name);
    if (existingNames.includes(playerName)) {
      this.sendError(connection, 'NAME_TAKEN', 'Name already taken in this room');
      return;
    }

    const player = room.addPlayer(connection.sessionId, playerName);
    if (!player) {
      this.sendError(connection, 'ROOM_FULL', 'Could not join room');
      return;
    }

    connection.roomCode = roomCode;
    connection.playerId = player.id;
    connection.playerName = playerName;

    // Send join confirmation to the joining player
    this.connectionManager.send(connection.sessionId, {
      type: 'ROOM_JOINED',
      roomCode,
      playerId: player.id,
      players: room.getLobbyPlayers(),
      gameType: room.gameType,
    });

    // Notify existing players
    const lobbyPlayer = {
      id: player.id,
      name: player.name,
      ready: player.ready,
      connected: player.connected,
    };
    for (const sid of room.getConnectedSessionIds()) {
      if (sid !== connection.sessionId) {
        this.connectionManager.send(sid, {
          type: 'PLAYER_JOINED',
          player: lobbyPlayer,
        });
      }
    }

    logger.info({ roomCode, playerId: player.id }, 'Player joined room');
  }

  leaveRoom(connection: Connection): void {
    if (!connection.roomCode) {
      this.sendError(connection, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    const room = this.rooms.get(connection.roomCode);
    if (!room) {
      connection.roomCode = null;
      connection.playerId = null;
      return;
    }

    const player = room.removePlayer(connection.sessionId);
    if (player) {
      // Notify remaining players
      for (const sid of room.getConnectedSessionIds()) {
        this.connectionManager.send(sid, {
          type: 'PLAYER_LEFT',
          playerId: player.id,
        });
      }
    }

    const roomCode = connection.roomCode;
    connection.roomCode = null;
    connection.playerId = null;
    connection.playerName = null;

    // Destroy empty rooms immediately
    if (room.playerCount === 0) {
      room.destroy('All players left');
    }

    logger.info({ roomCode, playerId: player?.id }, 'Player left room');
  }

  setReady(connection: Connection, ready: boolean): void {
    const room = this.getConnectionRoom(connection);
    if (!room) return;

    const player = room.setReady(connection.sessionId, ready);
    if (!player) {
      this.sendError(connection, 'INVALID_ACTION', 'Cannot change ready status');
      return;
    }

    for (const sid of room.getConnectedSessionIds()) {
      this.connectionManager.send(sid, {
        type: 'PLAYER_READY',
        playerId: player.id,
        ready: player.ready,
      });
    }
  }

  startGame(connection: Connection): void {
    const room = this.getConnectionRoom(connection);
    if (!room) return;

    if (!room.isHost(connection.sessionId)) {
      this.sendError(connection, 'NOT_HOST', 'Only the host can start the game');
      return;
    }

    const adapter = getGameAdapter(room.gameType);
    if (!adapter) {
      this.sendError(connection, 'INVALID_ACTION', `Unknown game type: ${room.gameType}`);
      return;
    }

    const canStart = room.canStart(adapter.minPlayers, adapter.maxPlayers);
    if (!canStart.ok) {
      const code = canStart.reason?.includes('at least') || canStart.reason?.includes('Too many') ? 'NOT_ENOUGH_PLAYERS' : 'PLAYERS_NOT_READY';
      this.sendError(connection, code, canStart.reason!);
      return;
    }

    const gameRoom = adapter.createGameRoom(room.getPlayerInfos());

    // Set up game room callbacks
    gameRoom.setCallbacks({
      broadcast: (sessionIds, message) => {
        for (const sid of sessionIds) {
          this.connectionManager.send(sid, message);
        }
      },
      sendToPlayer: (sessionId, message) => {
        this.connectionManager.send(sessionId, message);
      },
      getConnectedSessionIds: () => room.getConnectedSessionIds(),
      getPlayerSessionId: (playerId) => room.getPlayerById(playerId)?.sessionId ?? null,
      getAllSessionIds: () => room.getAllSessionIds(),
      onGameOver: () => room.onGameOver(),
    });

    room.startGame(gameRoom);

    // Send initial state to each player
    gameRoom.broadcastGameStarted();

    logger.info({ roomCode: room.code, playerCount: room.playerCount, gameType: room.gameType }, 'Game started');
  }

  handleGameAction(connection: Connection, message: { type: string; [key: string]: unknown }): void {
    const room = this.getConnectionRoom(connection);
    if (!room) return;

    const gameRoom = room.getGameRoom();
    if (!gameRoom) {
      this.sendError(connection, 'GAME_NOT_STARTED', 'Game has not started');
      return;
    }

    if (connection.playerId === null) {
      this.sendError(connection, 'INVALID_ACTION', 'No player ID');
      return;
    }

    // Validate action via game adapter
    const adapter = getGameAdapter(room.gameType);
    if (!adapter) {
      this.sendError(connection, 'INVALID_ACTION', 'Unknown game type');
      return;
    }

    const validation = adapter.validateAction(message);
    if (!validation.ok) {
      this.sendError(connection, 'INVALID_MESSAGE', validation.error);
      return;
    }

    gameRoom.handleAction(connection.playerId, connection.sessionId, validation.message);
  }

  handleDisconnect(connection: Connection): void {
    if (!connection.roomCode) return;

    const room = this.rooms.get(connection.roomCode);
    if (!room) return;

    room.setPlayerConnected(connection.sessionId, false);

    // If game is running, notify other players
    if (room.hasGame && connection.playerId !== null) {
      const gameRoom = room.getGameRoom();
      if (gameRoom) {
        gameRoom.handlePlayerDisconnect(connection.playerId);
      }
    }

    // Notify connected players
    if (connection.playerId !== null) {
      for (const sid of room.getConnectedSessionIds()) {
        this.connectionManager.send(sid, {
          type: 'PLAYER_LEFT',
          playerId: connection.playerId,
        });
      }
    }

    logger.info(
      { roomCode: connection.roomCode, playerId: connection.playerId },
      'Player disconnected'
    );
  }

  handleReconnect(connection: Connection): void {
    if (!connection.roomCode) return;

    const room = this.rooms.get(connection.roomCode);
    if (!room) {
      connection.roomCode = null;
      connection.playerId = null;
      return;
    }

    room.setPlayerConnected(connection.sessionId, true);

    // Send current room state
    this.connectionManager.send(connection.sessionId, {
      type: 'ROOM_JOINED',
      roomCode: connection.roomCode,
      playerId: connection.playerId!,
      players: room.getLobbyPlayers(),
      gameType: room.gameType,
    });

    // If game is in progress, send game state
    const gameRoom = room.getGameRoom();
    if (gameRoom && connection.playerId !== null) {
      gameRoom.handlePlayerReconnect(connection.playerId, connection.sessionId);
    }

    // Notify others about reconnection
    for (const sid of room.getConnectedSessionIds()) {
      if (sid !== connection.sessionId) {
        this.connectionManager.send(sid, {
          type: 'PLAYER_JOINED',
          player: {
            id: connection.playerId!,
            name: connection.playerName!,
            ready: room.getPlayer(connection.sessionId)?.ready ?? false,
            connected: true,
          },
        });
      }
    }

    logger.info(
      { roomCode: connection.roomCode, playerId: connection.playerId },
      'Player reconnected'
    );
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  private getConnectionRoom(connection: Connection): Room | null {
    if (!connection.roomCode) {
      this.sendError(connection, 'NOT_IN_ROOM', 'Not in a room');
      return null;
    }

    const room = this.rooms.get(connection.roomCode);
    if (!room) {
      this.sendError(connection, 'ROOM_NOT_FOUND', 'Room no longer exists');
      connection.roomCode = null;
      connection.playerId = null;
      return null;
    }

    return room;
  }

  private sendError(connection: Connection, code: string, message: string): void {
    this.connectionManager.send(connection.sessionId, {
      type: 'ERROR',
      code,
      message,
    });
  }

  private broadcastToRoom(roomCode: string, message: object): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    for (const sid of room.getConnectedSessionIds()) {
      this.connectionManager.send(sid, message);
    }
  }
}
