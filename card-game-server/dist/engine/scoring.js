// SOURCE: card-game-engine/src/engine/scoring.ts — keep in sync
export function findLowestUnique(playedCards) {
    const cardCounts = new Map();
    for (const { card } of playedCards) {
        cardCounts.set(card, (cardCounts.get(card) ?? 0) + 1);
    }
    // Get unique cards (count === 1), sorted ascending
    const uniqueCards = [...cardCounts.entries()]
        .filter(([, count]) => count === 1)
        .map(([card]) => card)
        .sort((a, b) => a - b);
    if (uniqueCards.length === 0)
        return null;
    const lowestUnique = uniqueCards[0];
    const winner = playedCards.find((pc) => pc.card === lowestUnique);
    return { winnerId: winner.playerId, points: lowestUnique };
}
//# sourceMappingURL=scoring.js.map