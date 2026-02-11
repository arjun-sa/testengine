import { Player, RoundResult } from '../engine/types';

interface ScoreBoardProps {
  players: Player[];
  roundHistory: RoundResult[];
  isGameOver: boolean;
}

export function ScoreBoard({ players, roundHistory, isGameOver }: ScoreBoardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = isGameOver ? sortedPlayers[0] : null;

  return (
    <div className="scoreboard">
      <h3>Scoreboard</h3>
      {isGameOver && winner && (
        <div className="winner-banner">{winner.name} wins with {winner.score} points!</div>
      )}
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p) => (
            <tr key={p.id} className={isGameOver && p.id === winner?.id ? 'winner-row' : ''}>
              <td>{p.name}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {roundHistory.length > 0 && (
        <div className="round-history">
          <h4>Round History</h4>
          {roundHistory.map((r) => (
            <div key={r.round} className="round-entry">
              <strong>Round {r.round}:</strong>{' '}
              {r.playedCards.map((pc) => (
                <span key={pc.playerId} className="played-card-entry">
                  {players.find((p) => p.id === pc.playerId)?.name}: {pc.card}
                </span>
              ))}
              {' — '}
              {r.winnerId !== null
                ? `${players.find((p) => p.id === r.winnerId)?.name} wins ${r.points} pts`
                : 'No winner (no unique card)'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
