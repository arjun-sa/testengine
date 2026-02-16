import { describe, it, expect } from 'vitest';
import { filterStateForPlayer } from '../../src/games/card-game/StateFilter.js';
import { createGame, selectPair, startReveal, startChoose, chooseCard, resolveRound } from '../../src/games/card-game/engine/gameEngine.js';
import { GameState } from '../../src/games/card-game/engine/types.js';

function setupSelectPhase(): GameState {
  let state = createGame(3);
  state = selectPair(state, 0, [3, 5]);
  return state;
}

function setupRevealPhase(): GameState {
  let state = createGame(3);
  state = selectPair(state, 0, [3, 5]);
  state = selectPair(state, 1, [2, 7]);
  state = selectPair(state, 2, [1, 4]);
  state = startReveal(state);
  return state;
}

function setupChoosePhase(): GameState {
  let state = setupRevealPhase();
  state = startChoose(state);
  state = chooseCard(state, 0, 3);
  return state;
}

function setupResolvePhase(): GameState {
  let state = setupRevealPhase();
  state = startChoose(state);
  state = chooseCard(state, 0, 3);
  state = chooseCard(state, 1, 2);
  state = chooseCard(state, 2, 1);
  state = resolveRound(state);
  return state;
}

const allConnected = new Set([0, 1, 2]);

describe('StateFilter', () => {
  describe('select phase', () => {
    it('should show own hand and selectedPair', () => {
      const state = setupSelectPhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      expect(view.you.hand).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(view.you.selectedPair).toEqual([3, 5]);
    });

    it('should hide other players selectedPair in select phase', () => {
      const state = setupSelectPhase();
      const view = filterStateForPlayer(state, 1, allConnected);

      // Player 1 looking at player 0
      const player0 = view.players.find((p) => p.id === 0)!;
      expect(player0.hasSelectedPair).toBe(true);
      expect(player0.selectedPair).toBeNull(); // hidden in select phase
    });

    it('should never expose other players hands', () => {
      const state = setupSelectPhase();
      const view = filterStateForPlayer(state, 1, allConnected);

      // No hand field on ClientPlayer
      const player0 = view.players.find((p) => p.id === 0)!;
      expect(player0).not.toHaveProperty('hand');
    });
  });

  describe('reveal phase', () => {
    it('should reveal all selectedPairs', () => {
      const state = setupRevealPhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      const player1 = view.players.find((p) => p.id === 1)!;
      expect(player1.selectedPair).toEqual([2, 7]);
    });

    it('should not reveal chosenCard', () => {
      const state = setupRevealPhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      const player1 = view.players.find((p) => p.id === 1)!;
      expect(player1.chosenCard).toBeNull();
    });
  });

  describe('choose phase', () => {
    it('should still show selectedPairs from reveal', () => {
      const state = setupChoosePhase();
      const view = filterStateForPlayer(state, 1, allConnected);

      const player0 = view.players.find((p) => p.id === 0)!;
      expect(player0.selectedPair).toEqual([3, 5]);
    });

    it('should not reveal other chosenCard in choose phase', () => {
      const state = setupChoosePhase();
      const view = filterStateForPlayer(state, 1, allConnected);

      const player0 = view.players.find((p) => p.id === 0)!;
      expect(player0.hasChosenCard).toBe(true);
      expect(player0.chosenCard).toBeNull(); // hidden during choose
    });

    it('should show own chosenCard', () => {
      const state = setupChoosePhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      expect(view.you.chosenCard).toBe(3);
    });
  });

  describe('resolve phase', () => {
    it('should include played cards in round history after resolve', () => {
      const state = setupResolvePhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      // After resolveRound, chosenCard is cleared by the engine (reset for next round)
      // The actual played card data is in roundHistory
      expect(view.roundHistory.length).toBe(1);
      const round = view.roundHistory[0];
      expect(round.playedCards.find((p) => p.playerId === 0)!.card).toBe(3);
      expect(round.playedCards.find((p) => p.playerId === 1)!.card).toBe(2);
      expect(round.playedCards.find((p) => p.playerId === 2)!.card).toBe(1);
    });

    it('should only show benchedCardCount not actual cards', () => {
      const state = setupResolvePhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      const player1 = view.players.find((p) => p.id === 1)!;
      expect(player1.benchedCardCount).toBeGreaterThanOrEqual(0);
      expect(player1).not.toHaveProperty('benchedCards');
    });

    it('should show own benchedCards fully', () => {
      const state = setupResolvePhase();
      const view = filterStateForPlayer(state, 0, allConnected);

      expect(view.you.benchedCards).toBeDefined();
      expect(Array.isArray(view.you.benchedCards)).toBe(true);
    });
  });

  describe('connection status', () => {
    it('should mark connected players correctly', () => {
      const state = setupSelectPhase();
      const partialConnected = new Set([0, 2]); // player 1 disconnected
      const view = filterStateForPlayer(state, 0, partialConnected);

      const player0 = view.players.find((p) => p.id === 0)!;
      expect(player0.connected).toBe(true);

      const player1 = view.players.find((p) => p.id === 1)!;
      expect(player1.connected).toBe(false);

      const player2 = view.players.find((p) => p.id === 2)!;
      expect(player2.connected).toBe(true);
    });
  });
});
