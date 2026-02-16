export type Phase = 'bidding' | 'reveal' | 'drawing' | 'results' | 'gameOver';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface DeckCard {
  suit: Suit;
  rank: string;
  isHealthy: boolean;
}

export interface Person {
  id: number;
}

export interface Contract {
  playerId: number;
  price: number;
  cost: number;
  profit: number;
}

export interface DrawResult {
  personId: number;
  card: DeckCard;
  isHealthy: boolean;
  contract: Contract | null;
}

export interface PlayerProfit {
  playerId: number;
  roundProfit: number;
  totalMoney: number;
}

export interface RoundResult {
  round: number;
  people: Person[];
  draws: DrawResult[];
  playerProfits: PlayerProfit[];
}
