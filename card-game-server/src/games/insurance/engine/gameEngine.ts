import { GameState, Player, Person, DrawResult, RoundResult } from './types.js';
import { createDeck, shuffleDeck } from './deck.js';

const HEALTHY_COST = 40;
const SICK_COST = 70;

function randomInt(min: number, max: number, rng?: () => number): number {
  const random = rng ?? Math.random;
  return Math.floor(random() * (max - min + 1)) + min;
}


export function createGame(playerCount: number, totalRounds = 6, rng?: () => number): GameState {
  const deck = shuffleDeck(createDeck(), rng);

  const players: Player[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      name: `Player ${i + 1}`,
      money: 0,
      healthyBid: null,
      sickBid: null,
    });
  }

  const healthyCeiling = randomInt(50, 80, rng);
  const sickCeiling = randomInt(80, 110, rng);

  const state: GameState = {
    phase: 'bidding',
    currentRound: 1,
    totalRounds,
    timer: 0,
    healthyCeiling,
    sickCeiling,
    paused: false,
    players,
    people: [],
    deck,
    draws: [],
    roundHistory: [],
  };

  return setupRound(state);
}

export function setupRound(state: GameState): GameState {
  const playerCount = state.players.length;
  const people: Person[] = [];
  for (let i = 0; i < playerCount; i++) {
    people.push({ id: i });
  }

  const players = state.players.map((p) => ({
    ...p,
    healthyBid: null,
    sickBid: null,
  }));

  return {
    ...state,
    phase: 'bidding',
    people,
    players,
    draws: [],
  };
}

export function submitBid(
  state: GameState,
  playerId: number,
  healthyBid: number,
  sickBid: number,
): GameState {
  if (state.phase !== 'bidding') return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.healthyBid !== null) return state;

  if (healthyBid < 1 || sickBid < 1) return state;

  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, healthyBid: healthyBid, sickBid: sickBid } : p,
    ),
  };
}

export function allBidsSubmitted(state: GameState): boolean {
  return state.players.every((p) => p.healthyBid !== null && p.sickBid !== null);
}

export function startReveal(state: GameState): GameState {
  return { ...state, phase: 'reveal' };
}

export function drawAndAssign(state: GameState, rng?: () => number): GameState {
  const remainingDeck = [...state.deck];
  const draws: DrawResult[] = [];

  // Create mutable copies — bids are nulled after a player wins that type
  const players = state.players.map((p) => ({ ...p }));

  for (const person of state.people) {
    if (remainingDeck.length === 0) {
      draws.push({
        personId: person.id,
        card: { suit: 'spades', rank: 'X', isHealthy: true },
        isHealthy: true,
        contract: null,
      });
      continue;
    }

    const card = remainingDeck.shift()!;
    const isHealthy = card.isHealthy;
    const ceiling = isHealthy ? state.healthyCeiling : state.sickCeiling;
    const cost = isHealthy ? HEALTHY_COST : SICK_COST;

    // Collect eligible bids: within ceiling, bid not yet used (null = already sold)
    interface EligibleBid { playerId: number; price: number }
    const eligible: EligibleBid[] = [];

    for (const p of players) {
      const bid = isHealthy ? p.healthyBid : p.sickBid;
      if (bid !== null && bid <= ceiling) {
        eligible.push({ playerId: p.id, price: bid });
      }
    }

    let contract = null;
    if (eligible.length > 0) {
      // Sort by price ascending
      eligible.sort((a, b) => a.price - b.price);

      // Find all tied at the lowest price, then pick randomly among them
      const lowestPrice = eligible[0].price;
      const tied = eligible.filter((e) => e.price === lowestPrice);
      const winner = tied.length === 1 ? tied[0] : tied[Math.floor((rng ?? Math.random)() * tied.length)];

      const profit = winner.price - cost;
      contract = {
        playerId: winner.playerId,
        price: winner.price,
        cost,
        profit,
      };

      // Void the winning player's bid for this type so they can't sell another
      const winningPlayer = players.find((p) => p.id === winner.playerId)!;
      winningPlayer.money += profit;
      if (isHealthy) {
        winningPlayer.healthyBid = null;
      } else {
        winningPlayer.sickBid = null;
      }
    }

    draws.push({ personId: person.id, card, isHealthy, contract });
  }

  return {
    ...state,
    phase: 'drawing',
    deck: remainingDeck,
    draws,
    players,
  };
}

export function startResults(state: GameState): GameState {
  const playerProfits = state.players.map((p) => {
    const roundProfit = state.draws
      .filter((d) => d.contract?.playerId === p.id)
      .reduce((sum, d) => sum + (d.contract?.profit ?? 0), 0);
    return {
      playerId: p.id,
      roundProfit,
      totalMoney: p.money,
    };
  });

  const roundResult: RoundResult = {
    round: state.currentRound,
    people: state.people,
    draws: state.draws,
    playerProfits,
  };

  const isLastRound = state.currentRound >= state.totalRounds;

  return {
    ...state,
    phase: isLastRound ? 'gameOver' : 'results',
    roundHistory: [...state.roundHistory, roundResult],
  };
}

export function startNextRound(state: GameState): GameState {
  return setupRound(
    { ...state, currentRound: state.currentRound + 1 },
  );
}
