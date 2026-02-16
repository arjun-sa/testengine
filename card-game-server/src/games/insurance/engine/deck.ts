import { DeckCard, Suit } from './types.js';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(): DeckCard[] {
  const cards: DeckCard[] = [];
  for (const suit of SUITS) {
    const isHealthy = suit === 'clubs' || suit === 'spades'; // black = healthy
    for (const rank of RANKS) {
      cards.push({ suit, rank, isHealthy });
    }
  }
  return cards;
}

export function shuffleDeck(deck: DeckCard[], rng?: () => number): DeckCard[] {
  const shuffled = [...deck];
  const random = rng ?? Math.random;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
