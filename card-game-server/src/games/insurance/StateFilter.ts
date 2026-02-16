import { GameState, Phase, DrawResult, RoundResult } from './engine/types.js';

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

export interface ClientPerson {
  id: number;
}

export interface ClientGameState {
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  timer: number;
  paused: boolean;
  you: {
    id: number;
    name: string;
    money: number;
    healthyBid: number | null;
    sickBid: number | null;
  };
  players: ClientPlayer[];
  people: ClientPerson[];
  deckInfo: DeckInfo;
  draws: DrawResult[];
  roundHistory: RoundResult[];
}

function shouldRevealBids(phase: Phase): boolean {
  return phase !== 'bidding';
}

export function filterStateForPlayer(
  state: GameState,
  playerId: number,
  connectedPlayerIds: Set<number>,
): ClientGameState {
  const self = state.players.find((p) => p.id === playerId);
  if (!self) {
    throw new Error(`Player ${playerId} not found in game state`);
  }

  const revealBids = shouldRevealBids(state.phase);

  const players: ClientPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    money: p.money,
    hasBid: p.healthyBid !== null,
    healthyBid: revealBids ? p.healthyBid : (p.id === playerId ? p.healthyBid : null),
    sickBid: revealBids ? p.sickBid : (p.id === playerId ? p.sickBid : null),
    connected: connectedPlayerIds.has(p.id),
  }));

  const redCount = state.deck.filter((c) => !c.isHealthy).length;
  const blackCount = state.deck.filter((c) => c.isHealthy).length;

  // People are sent without ceilings — ceilings are hidden from players
  const people: ClientPerson[] = state.people.map((p) => ({ id: p.id }));

  return {
    phase: state.phase,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    timer: state.timer,
    paused: state.paused,
    you: {
      id: self.id,
      name: self.name,
      money: self.money,
      healthyBid: self.healthyBid,
      sickBid: self.sickBid,
    },
    players,
    people,
    deckInfo: {
      remaining: state.deck.length,
      redCount,
      blackCount,
    },
    draws: state.draws,
    roundHistory: state.roundHistory,
  };
}
