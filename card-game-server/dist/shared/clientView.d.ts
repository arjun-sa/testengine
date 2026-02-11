import { GamePhase, RoundResult } from '../engine/types.js';
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
    roundHistory: RoundResult[];
    you: ClientSelfPlayer;
    players: ClientPlayer[];
}
//# sourceMappingURL=clientView.d.ts.map