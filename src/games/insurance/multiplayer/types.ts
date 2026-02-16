import { Phase, Person, DrawResult, RoundResult } from '../engine/types';

export interface ClientSelfPlayer {
  id: number;
  name: string;
  money: number;
  healthyBid: number | null;
  sickBid: number | null;
}

export interface ClientPlayer {
  id: number;
  name: string;
  money: number;
  hasBid: boolean;
  healthyBid: number | null;
  sickBid: number | null;
  connected: boolean;
}

export interface DeckInfo {
  remaining: number;
  redCount: number;
  blackCount: number;
}

export interface ClientGameState {
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  timer: number;
  paused: boolean;
  you: ClientSelfPlayer;
  players: ClientPlayer[];
  people: Person[];
  deckInfo: DeckInfo;
  draws: DrawResult[];
  roundHistory: RoundResult[];
}

export interface GameOverMessage {
  type: 'GAME_OVER';
  state: ClientGameState;
  finalScores: { playerId: number; name: string; money: number }[];
}
