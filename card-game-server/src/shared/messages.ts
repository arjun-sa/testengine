// ── Client → Server (Lobby messages only) ──

export interface CreateRoomMessage {
  type: 'CREATE_ROOM';
  playerName: string;
  gameType?: string;
}

export interface JoinRoomMessage {
  type: 'JOIN_ROOM';
  roomCode: string;
  playerName: string;
}

export interface LeaveRoomMessage {
  type: 'LEAVE_ROOM';
}

export interface SetReadyMessage {
  type: 'SET_READY';
  ready: boolean;
}

export interface StartGameMessage {
  type: 'START_GAME';
}

export interface PingMessage {
  type: 'PING';
}

export type LobbyClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | SetReadyMessage
  | StartGameMessage
  | PingMessage;

// Game actions are validated by their adapter, not here
export interface GameActionMessage {
  type: string;
  [key: string]: unknown;
}

export type ClientMessage = LobbyClientMessage | GameActionMessage;

// ── Server → Client ──

export interface LobbyPlayer {
  id: number;
  name: string;
  ready: boolean;
  connected: boolean;
}

export interface RoomCreatedMessage {
  type: 'ROOM_CREATED';
  roomCode: string;
  playerId: number;
  gameType: string;
}

export interface RoomJoinedMessage {
  type: 'ROOM_JOINED';
  roomCode: string;
  playerId: number;
  players: LobbyPlayer[];
  gameType: string;
}

export interface PlayerJoinedMessage {
  type: 'PLAYER_JOINED';
  player: LobbyPlayer;
}

export interface PlayerLeftMessage {
  type: 'PLAYER_LEFT';
  playerId: number;
}

export interface PlayerReadyMessage {
  type: 'PLAYER_READY';
  playerId: number;
  ready: boolean;
}

export interface RoomClosedMessage {
  type: 'ROOM_CLOSED';
  reason: string;
}

export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'PLAYERS_NOT_READY'
  | 'INVALID_ACTION'
  | 'GAME_NOT_STARTED'
  | 'RATE_LIMITED'
  | 'NAME_TAKEN';

export interface ErrorMessage {
  type: 'ERROR';
  code: ErrorCode;
  message: string;
}

export interface PongMessage {
  type: 'PONG';
}

export type ServerMessage =
  | RoomCreatedMessage
  | RoomJoinedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerReadyMessage
  | RoomClosedMessage
  | ErrorMessage
  | PongMessage;
