import { Person, DrawResult } from '../engine/types';
import { ClientPlayer } from '../multiplayer/types';

interface PersonCardProps {
  person: Person;
  draw?: DrawResult;
  players: ClientPlayer[];
}

function getSuitSymbol(suit: string): string {
  switch (suit) {
    case 'hearts': return '\u2665';
    case 'diamonds': return '\u2666';
    case 'clubs': return '\u2663';
    case 'spades': return '\u2660';
    default: return '?';
  }
}

export function PersonCard({ person, draw, players }: PersonCardProps) {
  const winner = draw?.contract ? players.find((p) => p.id === draw.contract!.playerId) : null;

  return (
    <div className={`ins-person-card ${draw ? (draw.isHealthy ? 'person-healthy' : 'person-sick') : ''}`}>
      <div className="person-header">Person #{person.id + 1}</div>

      {draw && (
        <div className="person-draw">
          <div className={`drawn-card ${draw.isHealthy ? 'card-black' : 'card-red'}`}>
            <span className="card-rank">{draw.card.rank}</span>
            <span className="card-suit">{getSuitSymbol(draw.card.suit)}</span>
          </div>
          <div className="draw-status">
            {draw.isHealthy ? 'Healthy' : 'Sick'}
          </div>
          {draw.contract ? (
            <div className="contract-info">
              <span className="contract-winner">{winner?.name}</span>
              <span className="contract-price">${draw.contract.price}</span>
              <span className={`contract-profit ${draw.contract.profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>
                {draw.contract.profit >= 0 ? '+' : ''}{draw.contract.profit}
              </span>
            </div>
          ) : (
            <div className="no-contract">No buyer</div>
          )}
        </div>
      )}
    </div>
  );
}
