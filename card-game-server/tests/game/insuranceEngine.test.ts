import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck } from '../../src/games/insurance/engine/deck';
import {
  createGame,
  submitBid,
  allBidsSubmitted,
  startReveal,
  drawAndAssign,
  startResults,
  startNextRound,
} from '../../src/games/insurance/engine/gameEngine';

// Seeded RNG for deterministic tests
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe('deck', () => {
  it('creates a 52-card deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('has 26 healthy (black) and 26 sick (red) cards', () => {
    const deck = createDeck();
    const healthy = deck.filter((c) => c.isHealthy);
    const sick = deck.filter((c) => !c.isHealthy);
    expect(healthy).toHaveLength(26);
    expect(sick).toHaveLength(26);
  });

  it('black suits are healthy, red suits are sick', () => {
    const deck = createDeck();
    for (const card of deck) {
      if (card.suit === 'clubs' || card.suit === 'spades') {
        expect(card.isHealthy).toBe(true);
      } else {
        expect(card.isHealthy).toBe(false);
      }
    }
  });

  it('shuffleDeck returns a different order', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
    const originalStr = deck.map((c) => `${c.rank}${c.suit}`).join(',');
    const shuffledStr = shuffled.map((c) => `${c.rank}${c.suit}`).join(',');
    expect(shuffledStr).not.toBe(originalStr);
  });

  it('shuffleDeck is deterministic with rng', () => {
    const deck = createDeck();
    const a = shuffleDeck(deck, makeRng(42));
    const b = shuffleDeck(deck, makeRng(42));
    expect(a).toEqual(b);
  });
});

describe('gameEngine', () => {
  it('createGame initializes correct state', () => {
    const state = createGame(3, 6, makeRng(1));
    expect(state.phase).toBe('bidding');
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(6);
    expect(state.players).toHaveLength(3);
    expect(state.people).toHaveLength(3);
    expect(state.deck).toHaveLength(52);
    expect(state.draws).toEqual([]);
    expect(state.roundHistory).toEqual([]);
    expect(state.paused).toBe(false);
    for (const p of state.players) {
      expect(p.money).toBe(0);
      expect(p.healthyBid).toBeNull();
      expect(p.sickBid).toBeNull();
    }
  });

  it('game has uniform ceilings for all people', () => {
    const state = createGame(4, 6, makeRng(2));
    expect(state.healthyCeiling).toBeGreaterThanOrEqual(50);
    expect(state.healthyCeiling).toBeLessThanOrEqual(80);
    expect(state.sickCeiling).toBeGreaterThanOrEqual(80);
    expect(state.sickCeiling).toBeLessThanOrEqual(110);
    // People don't have individual ceilings
    for (const person of state.people) {
      expect(person).toEqual({ id: person.id });
    }
  });

  it('ceilings stay the same across rounds', () => {
    const rng = makeRng(50);
    let state = createGame(2, 6, rng);
    const { healthyCeiling, sickCeiling } = state;

    state = submitBid(state, 0, 55, 90);
    state = submitBid(state, 1, 60, 95);
    state = startReveal(state);
    state = drawAndAssign(state, rng);
    state = startResults(state);
    state = startNextRound(state);

    expect(state.healthyCeiling).toBe(healthyCeiling);
    expect(state.sickCeiling).toBe(sickCeiling);
  });

  it('submitBid records bids', () => {
    const state = createGame(2, 6, makeRng(3));
    const updated = submitBid(state, 0, 55, 90);
    expect(updated.players[0].healthyBid).toBe(55);
    expect(updated.players[0].sickBid).toBe(90);
    expect(updated.players[1].healthyBid).toBeNull();
  });

  it('submitBid rejects duplicate bids', () => {
    let state = createGame(2, 6, makeRng(3));
    state = submitBid(state, 0, 55, 90);
    const same = submitBid(state, 0, 60, 100);
    expect(same.players[0].healthyBid).toBe(55);
  });

  it('submitBid rejects invalid prices', () => {
    const state = createGame(2, 6, makeRng(3));
    const invalid = submitBid(state, 0, 0, 90);
    expect(invalid.players[0].healthyBid).toBeNull();
  });

  it('allBidsSubmitted works correctly', () => {
    let state = createGame(2, 6, makeRng(3));
    expect(allBidsSubmitted(state)).toBe(false);
    state = submitBid(state, 0, 55, 90);
    expect(allBidsSubmitted(state)).toBe(false);
    state = submitBid(state, 1, 60, 95);
    expect(allBidsSubmitted(state)).toBe(true);
  });

  it('startReveal transitions phase', () => {
    const state = createGame(2, 6, makeRng(3));
    const revealed = startReveal(state);
    expect(revealed.phase).toBe('reveal');
  });

  it('drawAndAssign draws cards and assigns contracts', () => {
    const rng = makeRng(10);
    let state = createGame(3, 6, rng);
    state = submitBid(state, 0, 55, 90);
    state = submitBid(state, 1, 60, 95);
    state = submitBid(state, 2, 50, 85);
    state = startReveal(state);
    state = drawAndAssign(state, rng);

    expect(state.phase).toBe('drawing');
    expect(state.draws).toHaveLength(3);
    expect(state.deck).toHaveLength(52 - 3);

    for (const draw of state.draws) {
      expect(draw.card).toBeDefined();
      expect(typeof draw.isHealthy).toBe('boolean');
      if (draw.contract) {
        expect(draw.contract.playerId).toBeDefined();
        expect(draw.contract.price).toBeGreaterThan(0);
        expect(draw.contract.cost).toBeGreaterThan(0);
        expect(typeof draw.contract.profit).toBe('number');
      }
    }
  });

  it('contract goes to cheapest bidder within ceiling', () => {
    const rng = makeRng(100);
    let state = createGame(2, 6, rng);

    // Player 0 bids lower healthy price
    state = submitBid(state, 0, 45, 90);
    state = submitBid(state, 1, 70, 90);
    state = startReveal(state);
    state = drawAndAssign(state, rng);

    for (const draw of state.draws) {
      if (draw.isHealthy && draw.contract) {
        if (state.healthyCeiling >= 45) {
          expect(draw.contract.playerId).toBe(0);
          expect(draw.contract.price).toBe(45);
        }
      }
    }
  });

  it('tied bids are resolved randomly', () => {
    // Run many iterations to verify both players can win with same price
    const winners = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      let state = createGame(2, 6, rng);

      // Both bid the same prices
      state = submitBid(state, 0, 50, 85);
      state = submitBid(state, 1, 50, 85);
      state = startReveal(state);
      state = drawAndAssign(state, rng);

      for (const draw of state.draws) {
        if (draw.contract) {
          winners.add(draw.contract.playerId);
        }
      }
      if (winners.size >= 2) break;
    }
    // Both players should have won at least once across all seeds
    expect(winners.size).toBe(2);
  });

  it('max 1 contract per type per player per round', () => {
    const rng = makeRng(200);
    let state = createGame(8, 6, rng);

    // Player 0 bids cheaply, all others bid very high (out of ceiling)
    state = submitBid(state, 0, 41, 71);
    for (let i = 1; i < 8; i++) {
      state = submitBid(state, i, 999, 999);
    }
    state = startReveal(state);
    state = drawAndAssign(state, rng);

    const healthyContracts = state.draws.filter((d) => d.isHealthy && d.contract?.playerId === 0).length;
    const sickContracts = state.draws.filter((d) => !d.isHealthy && d.contract?.playerId === 0).length;
    expect(healthyContracts).toBeLessThanOrEqual(1);
    expect(sickContracts).toBeLessThanOrEqual(1);
  });

  it('startResults builds round result and transitions', () => {
    const rng = makeRng(50);
    let state = createGame(2, 6, rng);
    state = submitBid(state, 0, 55, 90);
    state = submitBid(state, 1, 60, 95);
    state = startReveal(state);
    state = drawAndAssign(state, rng);
    state = startResults(state);

    expect(state.phase).toBe('results');
    expect(state.roundHistory).toHaveLength(1);
    const result = state.roundHistory[0];
    expect(result.round).toBe(1);
    expect(result.draws).toHaveLength(2);
    expect(result.playerProfits).toHaveLength(2);
  });

  it('startResults transitions to gameOver on last round', () => {
    const rng = makeRng(50);
    let state = createGame(2, 1, rng);
    state = submitBid(state, 0, 55, 90);
    state = submitBid(state, 1, 60, 95);
    state = startReveal(state);
    state = drawAndAssign(state, rng);
    state = startResults(state);

    expect(state.phase).toBe('gameOver');
    expect(state.roundHistory).toHaveLength(1);
  });

  it('startNextRound increments round and resets', () => {
    const rng = makeRng(50);
    let state = createGame(2, 6, rng);
    state = submitBid(state, 0, 55, 90);
    state = submitBid(state, 1, 60, 95);
    state = startReveal(state);
    state = drawAndAssign(state, rng);
    state = startResults(state);
    state = startNextRound(state);

    expect(state.phase).toBe('bidding');
    expect(state.currentRound).toBe(2);
    expect(state.people).toHaveLength(2);
    for (const p of state.players) {
      expect(p.healthyBid).toBeNull();
      expect(p.sickBid).toBeNull();
    }
  });

  it('full 6-round game lifecycle', () => {
    const rng = makeRng(999);
    let state = createGame(3, 6, rng);

    for (let round = 1; round <= 6; round++) {
      expect(state.phase).toBe('bidding');
      expect(state.currentRound).toBe(round);

      state = submitBid(state, 0, 55, 90);
      state = submitBid(state, 1, 60, 95);
      state = submitBid(state, 2, 50, 85);
      expect(allBidsSubmitted(state)).toBe(true);

      state = startReveal(state);
      expect(state.phase).toBe('reveal');

      state = drawAndAssign(state, rng);
      expect(state.phase).toBe('drawing');
      expect(state.draws).toHaveLength(3);

      state = startResults(state);

      if (round < 6) {
        expect(state.phase).toBe('results');
        expect(state.roundHistory).toHaveLength(round);
        state = startNextRound(state);
      } else {
        expect(state.phase).toBe('gameOver');
        expect(state.roundHistory).toHaveLength(6);
      }
    }

    expect(state.deck).toHaveLength(52 - 18);
  });

  it('deck is drawn without replacement across rounds', () => {
    const rng = makeRng(777);
    let state = createGame(4, 6, rng);
    const initialDeckSize = state.deck.length;

    for (let round = 1; round <= 3; round++) {
      for (let i = 0; i < 4; i++) {
        state = submitBid(state, i, 50, 85);
      }
      state = startReveal(state);
      state = drawAndAssign(state, rng);
      expect(state.deck).toHaveLength(initialDeckSize - round * 4);
      state = startResults(state);
      if (round < 3) state = startNextRound(state);
    }
  });
});
