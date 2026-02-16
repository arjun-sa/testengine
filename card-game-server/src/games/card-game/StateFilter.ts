import { GameState, GamePhase } from './engine/types.js';

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
  roundHistory: import('./engine/types.js').RoundResult[];
  you: ClientSelfPlayer;
  players: ClientPlayer[];
}

/**
 * Privacy rules by phase:
 *
 * | Field        | Owner  | Others (select) | Others (reveal) | Others (choose) | Others (resolve+) |
 * |-------------|--------|-----------------|-----------------|-----------------|-------------------|
 * | hand         | Always | Never           | Never           | Never           | Never             |
 * | selectedPair | Always | Never           | Visible         | Visible         | Visible           |
 * | chosenCard   | Always | Never           | Never           | Never           | Visible           |
 * | benchedCards | Always | Never           | Never           | Never           | Never             |
 * | score        | Always | Always          | Always          | Always          | Always            |
 */

function shouldRevealSelectedPair(phase: GamePhase): boolean {
  return phase === 'reveal' || phase === 'choose' || phase === 'resolve' || phase === 'gameOver';
}

function shouldRevealChosenCard(phase: GamePhase): boolean {
  return phase === 'resolve' || phase === 'gameOver';
}

export function filterStateForPlayer(
  state: GameState,
  playerId: number,
  connectedPlayerIds: Set<number>
): ClientGameState {
  const self = state.players.find((p) => p.id === playerId);
  if (!self) {
    throw new Error(`Player ${playerId} not found in game state`);
  }

  const you: ClientSelfPlayer = {
    id: self.id,
    name: self.name,
    score: self.score,
    hand: self.hand,
    selectedPair: self.selectedPair,
    chosenCard: self.chosenCard,
    benchedCards: self.benchedCards,
  };

  const players: ClientPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    hasSelectedPair: p.selectedPair !== null,
    hasChosenCard: p.chosenCard !== null,
    selectedPair: shouldRevealSelectedPair(state.phase) ? p.selectedPair : null,
    chosenCard: shouldRevealChosenCard(state.phase) ? p.chosenCard : null,
    benchedCardCount: p.benchedCards.length,
    connected: connectedPlayerIds.has(p.id),
  }));

  return {
    phase: state.phase,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    timer: state.timer,
    roundHistory: state.roundHistory,
    you,
    players,
  };
}
