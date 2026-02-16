import { GamePhase, RoundResult } from '../engine/types';

// ── Client View Types (card-game specific) ──

export interface ClientSelfPlayer {
  id: number;
  name: string;
  score: number;
  hand: number[];
  selectedPair: [number, number] | null;
  chosenCard: number | null;
  benchedCards: number[];
}

export interface ClientPlayer {
  id: number;
  name: string;
  score: number;
  hasSelectedPair: boolean;
  hasChosenCard: boolean;
  selectedPair: [number, number] | null;
  chosenCard: number | null;
  benchedCardCount: number;
  connected: boolean;
}

export interface ClientGameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  timer: number;
  roundHistory: RoundResult[];
  you: ClientSelfPlayer;
  players: ClientPlayer[];
}

// ── Card-game specific server messages ──

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

export type CardGameServerMessage =
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
  | GameOverMessage;
