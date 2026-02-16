import { ClientPlayer } from '../multiplayer/types';
import { RoundResult } from '../engine/types';

interface ScoreboardProps {
  players: ClientPlayer[];
  roundHistory: RoundResult[];
  isGameOver: boolean;
}

export function Scoreboard({ players, roundHistory, isGameOver }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.money - a.money);

  return (
    <div className="ins-scoreboard">
      {isGameOver && sorted.length > 0 && (
        <div className="winner-banner">
          {sorted[0].name} wins with ${sorted[0].money}!
        </div>
      )}
      <h3>Standings</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={p.id} className={isGameOver && i === 0 ? 'winner-row' : ''}>
              <td>{i + 1}</td>
              <td>{p.name}</td>
              <td className={p.money >= 0 ? 'profit-pos' : 'profit-neg'}>
                ${p.money}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {roundHistory.length > 0 && (
        <div className="ins-round-history">
          <h4>Round History</h4>
          {roundHistory.map((r) => (
            <div key={r.round} className="ins-round-entry">
              <span className="round-num">R{r.round}</span>
              {r.playerProfits.map((pp) => {
                const player = players.find((p) => p.id === pp.playerId);
                return (
                  <span key={pp.playerId} className="round-profit-entry">
                    {player?.name}: <span className={pp.roundProfit >= 0 ? 'profit-pos' : 'profit-neg'}>
                      {pp.roundProfit >= 0 ? '+' : ''}{pp.roundProfit}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
