export interface PlayedCard {
  playerId: number;
  card: number;
}

export interface RoundScore {
  winnerId: number;
  points: number;
}

export function findLowestUnique(playedCards: PlayedCard[]): RoundScore | null {
  const cardCounts = new Map<number, number>();
  for (const { card } of playedCards) {
    cardCounts.set(card, (cardCounts.get(card) ?? 0) + 1);
  }

  // Get unique cards (count === 1), sorted ascending
  const uniqueCards = [...cardCounts.entries()]
    .filter(([, count]) => count === 1)
    .map(([card]) => card)
    .sort((a, b) => a - b);

  if (uniqueCards.length === 0) return null;

  const lowestUnique = uniqueCards[0];
  const winner = playedCards.find((pc) => pc.card === lowestUnique)!;

  return { winnerId: winner.playerId, points: lowestUnique };
}
