import { GamePhase } from '../engine/types';
import { ClientSelfPlayer } from '../multiplayer/types';
import { Card } from './Card';

interface PlayerHandProps {
  player: ClientSelfPlayer;
  phase: GamePhase;
  selectedCards: number[];
  onCardClick: (card: number) => void;
}

export function PlayerHand({ player, phase, selectedCards, onCardClick }: PlayerHandProps) {
  const sortedHand = [...player.hand].sort((a, b) => a - b);

  return (
    <div className="player-hand">
      <h3>{player.name}'s Hand</h3>
      <div className="cards">
        {sortedHand.map((card) => {
          const isBenched = player.benchedCards.includes(card);
          const isSelected = selectedCards.includes(card);
          const isInPair = player.selectedPair?.includes(card) ?? false;

          let disabled = false;
          if (phase === 'select') {
            disabled = isBenched || (selectedCards.length >= 2 && !isSelected);
          } else if (phase === 'choose') {
            disabled = !isInPair;
          } else {
            disabled = true;
          }

          return (
            <Card
              key={card}
              value={card}
              faceUp={true}
              selected={isSelected || (phase === 'choose' && isInPair && selectedCards.includes(card))}
              benched={isBenched}
              disabled={disabled}
              onClick={() => onCardClick(card)}
            />
          );
        })}
      </div>
      {player.benchedCards.length > 0 && (
        <div className="benched-info">
          Benched: {player.benchedCards.sort((a, b) => a - b).join(', ')}
        </div>
      )}
    </div>
  );
}
