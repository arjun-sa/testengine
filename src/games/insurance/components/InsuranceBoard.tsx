import { ClientGameState, GameOverMessage } from '../multiplayer/types';
import { PersonCard } from './PersonCard';
import { BidForm } from './BidForm';
import { BidReveal } from './BidReveal';
import { DrawAnimation } from './DrawAnimation';
import { Scoreboard } from './Scoreboard';

interface InsuranceBoardProps {
  gameState: ClientGameState;
  gameOverData: GameOverMessage | null;
  isHost: boolean;
  onSubmitBid: (healthyPrice: number, sickPrice: number) => void;
  onSkipTimer: () => void;
  onTogglePause: () => void;
  onLeaveRoom: () => void;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'bidding': return 'Submit Bids';
    case 'reveal': return 'Bids Revealed';
    case 'drawing': return 'Drawing Cards';
    case 'results': return 'Round Results';
    case 'gameOver': return 'Game Over';
    default: return phase;
  }
}

export function InsuranceBoard({
  gameState,
  gameOverData,
  isHost,
  onSubmitBid,
  onSkipTimer,
  onTogglePause,
  onLeaveRoom,
}: InsuranceBoardProps) {
  const { phase, you, players, people, deckInfo, draws, roundHistory } = gameState;

  return (
    <div className="ins-board">
      {/* Pause Overlay */}
      {gameState.paused && (
        <div className="ins-paused-overlay">
          <div className="ins-paused-banner">
            Game Paused
            {isHost && (
              <button className="confirm-btn" onClick={onTogglePause}>Resume</button>
            )}
          </div>
        </div>
      )}

      {/* Phase Header */}
      <div className="ins-phase-display">
        <div className="phase-info">
          <span className="round-label">
            Round {Math.min(gameState.currentRound, gameState.totalRounds)} / {gameState.totalRounds}
          </span>
          <span className="phase-label">{phaseLabel(phase)}</span>
        </div>
        <div className="ins-deck-info">
          <span title="Cards remaining">Deck: {deckInfo.remaining}</span>
          <span className="deck-red" title="Red (sick) cards">{deckInfo.redCount}</span>
          <span className="deck-black" title="Black (healthy) cards">{deckInfo.blackCount}</span>
        </div>
        <div className="ins-header-actions">
          {gameState.timer > 0 && (
            <div className="timer-section">
              <span className="timer">{gameState.timer}s</span>
              {isHost && (phase === 'reveal' || phase === 'results') && (
                <button className="skip-btn" onClick={onSkipTimer}>Skip</button>
              )}
            </div>
          )}
          {isHost && phase !== 'gameOver' && (
            <button
              className={`skip-btn ${gameState.paused ? 'pause-active' : ''}`}
              onClick={onTogglePause}
            >
              {gameState.paused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>

      {/* Bidding Phase */}
      {phase === 'bidding' && (
        <div className="ins-bidding-phase">
          <div className="person-grid">
            {people.map((person) => (
              <PersonCard key={person.id} person={person} players={players} />
            ))}
          </div>
          <BidForm onSubmit={onSubmitBid} hasBid={you.healthyBid !== null} disabled={gameState.paused} />
          <div className="other-players-status">
            {players
              .filter((p) => p.id !== you.id)
              .map((p) => (
                <div key={p.id} className="player-status">
                  <span>{p.name}</span>
                  <span className={`status-indicator ${p.hasBid ? 'done' : 'waiting'}`}>
                    {p.hasBid ? 'Bid' : 'Waiting...'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Reveal Phase */}
      {phase === 'reveal' && (
        <div className="ins-reveal-phase">
          <div className="person-grid">
            {people.map((person) => (
              <PersonCard key={person.id} person={person} players={players} />
            ))}
          </div>
          <BidReveal players={players} />
        </div>
      )}

      {/* Drawing Phase */}
      {phase === 'drawing' && (
        <DrawAnimation draws={draws} people={people} players={players} paused={gameState.paused} />
      )}

      {/* Results Phase */}
      {phase === 'results' && (
        <div className="ins-results-phase">
          <div className="person-grid">
            {people.map((person) => {
              const draw = draws.find((d) => d.personId === person.id);
              return (
                <PersonCard key={person.id} person={person} draw={draw} players={players} />
              );
            })}
          </div>
          {roundHistory.length > 0 && (() => {
            const lastRound = roundHistory[roundHistory.length - 1];
            return (
              <div className="round-profit-summary">
                <h3>Round {lastRound.round} Profit</h3>
                <div className="profit-chips">
                  {lastRound.playerProfits.map((pp) => {
                    const player = players.find((p) => p.id === pp.playerId);
                    return (
                      <div key={pp.playerId} className="profit-chip">
                        <span>{player?.name}</span>
                        <span className={pp.roundProfit >= 0 ? 'profit-pos' : 'profit-neg'}>
                          {pp.roundProfit >= 0 ? '+' : ''}${pp.roundProfit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Game Over */}
      {phase === 'gameOver' && (
        <div className="game-over">
          <h2>Game Over!</h2>
          {gameOverData && (
            <div className="final-scores">
              {gameOverData.finalScores
                .sort((a, b) => b.money - a.money)
                .map((entry, i) => (
                  <div key={entry.playerId} className={`final-score-entry ${i === 0 ? 'winner-row' : ''}`}>
                    <span className="rank">#{i + 1}</span>
                    <span className="player-name">{entry.name}</span>
                    <span className="score">${entry.money}</span>
                  </div>
                ))}
            </div>
          )}
          <button className="leave-btn" onClick={onLeaveRoom}>Leave Room</button>
        </div>
      )}

      <Scoreboard
        players={players}
        roundHistory={roundHistory}
        isGameOver={phase === 'gameOver'}
      />
    </div>
  );
}
