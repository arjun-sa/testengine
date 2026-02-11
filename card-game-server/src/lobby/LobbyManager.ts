import { Room } from './Room.js';
import { generateRoomCode } from './RoomCodeGenerator.js';
import { Connection, ConnectionManager } from '../server/ConnectionManager.js';
import { ClientMessage, ServerMessage } from '../shared/messages.js';
import { logger } from '../utils/logger.js';

export class LobbyManager {
  private rooms = new Map<string, Room>();

  constructor(
    private connectionManager: ConnectionManager,
    private maxRooms: number = 100
  ) {}

  createRoom(connection: Connection, playerName: string): void {
    if (connection.roomCode) {
      this.sendError(connection, 'INVALID_ACTION', 'Already in a room');
      return;
    }

    if (this.rooms.size >= this.maxRooms) {
      this.sendError(connection, 'INVALID_ACTION', 'Server full, try again later');
      return;
    }

    const existingCodes = new Set(this.rooms.keys());
    const code = generateRoomCode(existingCodes);

    const room = new Room(code, connection.sessionId, (roomCode) => {
      this.rooms.delete(roomCode);
      // Notify remaining connected players
      this.broadcastToRoom(roomCode, { type: 'ROOM_CLOSED', reason: 'Room expired' });
      logger.info({ roomCode }, 'Room destroyed');
    });

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
    });

    logger.info({ roomCode: code, sessionId: connection.sessionId }, 'Room created');
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

    // Destroy empty rooms immediately if in lobby
    if (room.playerCount === 0 && !room.hasGame) {
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

    const canStart = room.canStart();
    if (!canStart.ok) {
      const code = canStart.reason?.includes('2 players') ? 'NOT_ENOUGH_PLAYERS' : 'PLAYERS_NOT_READY';
      this.sendError(connection, code, canStart.reason!);
      return;
    }

    const gameRoom = room.startGame();

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

    // Send initial state to each player
    gameRoom.broadcastGameStarted();

    logger.info({ roomCode: room.code, playerCount: room.playerCount }, 'Game started');
  }

  handleGameAction(connection: Connection, message: ClientMessage): void {
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

    switch (message.type) {
      case 'SELECT_PAIR':
        gameRoom.handleSelectPair(connection.playerId, connection.sessionId, message.cards);
        break;
      case 'CHOOSE_CARD':
        gameRoom.handleChooseCard(connection.playerId, connection.sessionId, message.card);
        break;
      case 'REQUEST_STATE':
        gameRoom.sendStateToPlayer(connection.playerId, connection.sessionId);
        break;
    }
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
      code: code as any,
      message,
    });
  }

  private broadcastToRoom(roomCode: string, message: ServerMessage): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    for (const sid of room.getConnectedSessionIds()) {
      this.connectionManager.send(sid, message);
    }
  }
}
