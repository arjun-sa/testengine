// SOURCE: card-game-engine/src/engine/gameEngine.ts — keep in sync

import { GameState, Player } from './types.js';
import { findLowestUnique } from './scoring.js';

export function createGame(playerCount: number, totalRounds: number = 8): GameState {
  const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    name: `Player ${i + 1}`,
    hand: [1, 2, 3, 4, 5, 6, 7, 8],
    selectedPair: null,
    chosenCard: null,
    benchedCards: [],
    score: 0,
  }));

  return {
    players,
    currentRound: 1,
    totalRounds,
    phase: 'select',
    timer: 0,
    roundHistory: [],
    activePlayerIndex: 0,
  };
}

export function selectPair(
  state: GameState,
  playerId: number,
  cards: [number, number]
): GameState {
  if (state.phase !== 'select') return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  // Validate both cards are in hand and not benched
  for (const card of cards) {
    if (!player.hand.includes(card)) return state;
    if (player.benchedCards.includes(card)) return state;
  }
  if (cards[0] === cards[1]) return state;

  const newPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, selectedPair: cards } : p
  );

  // Move to next player or advance phase if all have selected
  const nextActiveIndex = state.activePlayerIndex + 1;
  const allSelected = newPlayers.every((p) => p.selectedPair !== null);

  return {
    ...state,
    players: newPlayers,
    activePlayerIndex: allSelected ? 0 : nextActiveIndex,
  };
}

export function allPairsSelected(state: GameState): boolean {
  return state.players.every((p) => p.selectedPair !== null);
}

export function startReveal(state: GameState): GameState {
  if (state.phase !== 'select') return state;
  if (!allPairsSelected(state)) return state;

  return {
    ...state,
    phase: 'reveal',
    timer: 60,
    activePlayerIndex: 0,
  };
}

export function tickTimer(state: GameState): GameState {
  if (state.phase !== 'reveal') return state;
  const newTimer = Math.max(0, state.timer - 1);
  return { ...state, timer: newTimer };
}

export function startChoose(state: GameState): GameState {
  if (state.phase !== 'reveal') return state;
  return {
    ...state,
    phase: 'choose',
    timer: 0,
    activePlayerIndex: 0,
  };
}

export function chooseCard(
  state: GameState,
  playerId: number,
  card: number
): GameState {
  if (state.phase !== 'choose') return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.selectedPair) return state;

  // Validate the chosen card is one of the selected pair
  if (!player.selectedPair.includes(card)) return state;

  const benchedCard = player.selectedPair.find((c) => c !== card)!;

  const newPlayers = state.players.map((p) =>
    p.id === playerId
      ? { ...p, chosenCard: card, benchedCards: [...p.benchedCards, benchedCard] }
      : p
  );

  const nextActiveIndex = state.activePlayerIndex + 1;

  return {
    ...state,
    players: newPlayers,
    activePlayerIndex: nextActiveIndex,
  };
}

export function allCardsChosen(state: GameState): boolean {
  return state.players.every((p) => p.chosenCard !== null);
}

export function resolveRound(state: GameState): GameState {
  if (state.phase !== 'choose') return state;
  if (!allCardsChosen(state)) return state;

  const playedCards = state.players.map((p) => ({
    playerId: p.id,
    card: p.chosenCard!,
  }));

  const result = findLowestUnique(playedCards);

  const roundResult = {
    round: state.currentRound,
    playedCards,
    winnerId: result?.winnerId ?? null,
    points: result?.points ?? 0,
  };

  // Update scores and clean up for next round
  const newPlayers = state.players.map((p) => {
    // Remove chosen card and benched card from hand
    const usedCards = p.selectedPair!;
    const newHand = p.hand.filter((c) => !usedCards.includes(c));

    // Unbenched cards from previous rounds (cards benched before this round)
    // Only keep cards that were benched THIS round
    const newlyBenchedCard = p.selectedPair!.find((c) => c !== p.chosenCard)!;
    const newBenchedCards = [newlyBenchedCard];

    return {
      ...p,
      hand: [...newHand, ...p.benchedCards.filter((c) => c !== newlyBenchedCard)],
      selectedPair: null,
      chosenCard: null,
      benchedCards: newBenchedCards,
      score: p.score + (result?.winnerId === p.id ? result.points : 0),
    };
  });

  const nextRound = state.currentRound + 1;
  const isGameOver = nextRound > state.totalRounds;

  return {
    ...state,
    players: newPlayers,
    currentRound: nextRound,
    phase: isGameOver ? 'gameOver' : 'resolve',
    roundHistory: [...state.roundHistory, roundResult],
    activePlayerIndex: 0,
    timer: 0,
  };
}

export function startNextRound(state: GameState): GameState {
  if (state.phase !== 'resolve') return state;
  return {
    ...state,
    phase: 'select',
    activePlayerIndex: 0,
  };
}
