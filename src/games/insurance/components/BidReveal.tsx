import { ClientPlayer } from '../multiplayer/types';

interface BidRevealProps {
  players: ClientPlayer[];
}

export function BidReveal({ players }: BidRevealProps) {
  return (
    <div className="ins-bid-reveal">
      <h3>All Bids</h3>
      <table className="bid-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Healthy Price</th>
            <th>Sick Price</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>${p.healthyBid ?? '—'}</td>
              <td>${p.sickBid ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
