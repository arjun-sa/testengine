export interface PlayedCard {
    playerId: number;
    card: number;
}
export interface RoundScore {
    winnerId: number;
    points: number;
}
export declare function findLowestUnique(playedCards: PlayedCard[]): RoundScore | null;
//# sourceMappingURL=scoring.d.ts.map