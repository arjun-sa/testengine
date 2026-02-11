export type GamePhase = 'setup' | 'select' | 'reveal' | 'choose' | 'resolve' | 'gameOver';
export interface Player {
    id: number;
    name: string;
    hand: number[];
    selectedPair: [number, number] | null;
    chosenCard: number | null;
    benchedCards: number[];
    score: number;
}
export interface RoundResult {
    round: number;
    playedCards: {
        playerId: number;
        card: number;
    }[];
    winnerId: number | null;
    points: number;
}
export interface GameState {
    players: Player[];
    currentRound: number;
    totalRounds: number;
    phase: GamePhase;
    timer: number;
    roundHistory: RoundResult[];
    activePlayerIndex: number;
}
//# sourceMappingURL=types.d.ts.map