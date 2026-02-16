export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export type Screen = 'home' | 'lobby' | 'game';

export interface LobbyPlayer {
  id: number;
  name: string;
  ready: boolean;
  connected: boolean;
}

// Lobby server → client messages
export interface SessionEstablishedMessage {
  type: 'SESSION_ESTABLISHED';
  sessionId: string;
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

export interface ErrorMessage {
  type: 'ERROR';
  code: string;
  message: string;
}

export interface PongMessage {
  type: 'PONG';
}

export type LobbyServerMessage =
  | SessionEstablishedMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerReadyMessage
  | RoomClosedMessage
  | ErrorMessage
  | PongMessage;

// Generic server message (lobby + any game-specific)
export type ServerMessage = LobbyServerMessage | { type: string; [key: string]: unknown };
