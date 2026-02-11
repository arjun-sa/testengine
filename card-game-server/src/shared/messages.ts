import { ClientGameState } from './clientView.js';
import { RoundResult } from '../engine/types.js';

// ── Client → Server ──

export interface CreateRoomMessage {
  type: 'CREATE_ROOM';
  playerName: string;
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

export interface SelectPairMessage {
  type: 'SELECT_PAIR';
  cards: [number, number];
}

export interface ChooseCardMessage {
  type: 'CHOOSE_CARD';
  card: number;
}

export interface RequestStateMessage {
  type: 'REQUEST_STATE';
}

export interface PingMessage {
  type: 'PING';
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | SetReadyMessage
  | StartGameMessage
  | SelectPairMessage
  | ChooseCardMessage
  | RequestStateMessage
  | PingMessage;

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
}

export interface RoomJoinedMessage {
  type: 'ROOM_JOINED';
  roomCode: string;
  playerId: number;
  players: LobbyPlayer[];
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

export interface GameStartedMessage {
  type: 'GAME_STARTED';
  state: ClientGameState;
}

export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  state: ClientGameState;
}

export interface PhaseChangedMessage {
  type: 'PHASE_CHANGED';
  phase: string;
  state: ClientGameState;
}

export interface PairSelectedMessage {
  type: 'PAIR_SELECTED';
  playerId: number;
}

export interface AllPairsSelectedMessage {
  type: 'ALL_PAIRS_SELECTED';
}

export interface TimerTickMessage {
  type: 'TIMER_TICK';
  timer: number;
}

export interface TimerExpiredMessage {
  type: 'TIMER_EXPIRED';
}

export interface CardChosenMessage {
  type: 'CARD_CHOSEN';
  playerId: number;
}

export interface AllCardsChosenMessage {
  type: 'ALL_CARDS_CHOSEN';
}

export interface RoundResultMessage {
  type: 'ROUND_RESULT';
  result: RoundResult;
  state: ClientGameState;
}

export interface GameOverMessage {
  type: 'GAME_OVER';
  state: ClientGameState;
  finalScores: { playerId: number; name: string; score: number }[];
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
  | GameStartedMessage
  | StateUpdateMessage
  | PhaseChangedMessage
  | PairSelectedMessage
  | AllPairsSelectedMessage
  | TimerTickMessage
  | TimerExpiredMessage
  | CardChosenMessage
  | AllCardsChosenMessage
  | RoundResultMessage
  | GameOverMessage
  | ErrorMessage
  | PongMessage;
