export type Phase = 'bidding' | 'reveal' | 'drawing' | 'results' | 'gameOver';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface DeckCard {
  suit: Suit;
  rank: string; // 'A','2'-'10','J','Q','K'
  isHealthy: boolean; // black = healthy, red = sick
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

export interface Player {
  id: number;
  name: string;
  money: number;
  healthyBid: number | null;
  sickBid: number | null;
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

export interface GameState {
  phase: Phase;
  currentRound: number;
  totalRounds: number;
  timer: number;
  healthyCeiling: number; // 50-80, same for all people, set once at game creation
  sickCeiling: number;    // 80-110, same for all people, set once at game creation
  paused: boolean;
  players: Player[];
  people: Person[];
  deck: DeckCard[];
  draws: DrawResult[];
  roundHistory: RoundResult[];
}
