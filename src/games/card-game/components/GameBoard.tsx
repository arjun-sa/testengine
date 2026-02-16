import { useState, useEffect, useRef } from 'react';
import { ClientGameState, GameOverMessage } from '../multiplayer/types';
import { PlayerHand } from './PlayerHand';
import { PhaseDisplay } from './PhaseDisplay';
import { ScoreBoard } from './ScoreBoard';
import { Card } from './Card';

interface GameBoardProps {
  gameState: ClientGameState;
  gameOverData: GameOverMessage | null;
  isHost: boolean;
  onSelectPair: (cards: [number, number]) => void;
  onChooseCard: (card: number) => void;
  onSkipTimer: () => void;
  onLeaveRoom: () => void;
}

export function GameBoard({
  gameState,
  gameOverData,
  isHost,
  onSelectPair,
  onChooseCard,
  onSkipTimer,
  onLeaveRoom,
}: GameBoardProps) {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [preselectedCard, setPreselectedCard] = useState<number | null>(null);
  const prevPhaseRef = useRef(gameState.phase);
  const { phase, you, players } = gameState;

  // When phase transitions from reveal → choose, auto-submit preselected card
  useEffect(() => {
    if (prevPhaseRef.current === 'reveal' && phase === 'choose' && preselectedCard !== null) {
      onChooseCard(preselectedCard);
      setPreselectedCard(null);
    }
    prevPhaseRef.current = phase;
  }, [phase, preselectedCard, onChooseCard]);

  const handleCardClick = (card: number) => {
    if (phase === 'select') {
      setSelectedCards((prev) => {
        if (prev.includes(card)) return prev.filter((c) => c !== card);
        if (prev.length >= 2) return prev;
        return [...prev, card];
      });
    } else if (phase === 'choose') {
      onChooseCard(card);
    }
  };

  const handlePreselect = (card: number) => {
    setPreselectedCard((prev) => (prev === card ? null : card));
  };

  const handleConfirmPair = () => {
    if (selectedCards.length === 2) {
      onSelectPair(selectedCards as [number, number]);
      setSelectedCards([]);
    }
  };

  return (
    <div className="game-board">
      <PhaseDisplay
        phase={phase}
        currentRound={Math.min(gameState.currentRound, gameState.totalRounds)}
        totalRounds={gameState.totalRounds}
        timer={gameState.timer}
        onSkipTimer={isHost ? onSkipTimer : undefined}
      />

      {/* Select Phase: show your hand, status of others */}
      {phase === 'select' && (
        <div className="active-phase">
          <PlayerHand
            player={you}
            phase={phase}
            selectedCards={selectedCards}
            onCardClick={handleCardClick}
          />
          <button
            className="confirm-btn"
            disabled={selectedCards.length !== 2}
            onClick={handleConfirmPair}
          >
            Confirm Selection
          </button>
          <div className="other-players-status">
            {players
              .filter((p) => p.id !== you.id)
              .map((p) => (
                <div key={p.id} className="player-status">
                  <span>{p.name}</span>
                  <span className={`status-indicator ${p.hasSelectedPair ? 'done' : 'waiting'}`}>
                    {p.hasSelectedPair ? 'Selected' : 'Waiting...'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Reveal Phase: show all players' selected pairs + preselect your card */}
      {phase === 'reveal' && (
        <div className="reveal-phase">
          <h3>All Selected Pairs</h3>
          <div className="reveal-grid">
            {players.map((p) => (
              <div key={p.id} className={`reveal-player ${p.id === you.id ? 'reveal-self' : ''}`}>
                <h4>{p.name}{p.id === you.id ? ' (you)' : ''}</h4>
                <div className="cards">
                  {(p.id === you.id ? you.selectedPair : p.selectedPair)?.map((card) => (
                    <Card
                      key={card}
                      value={card}
                      faceUp={true}
                      selected={p.id === you.id && preselectedCard === card}
                      onClick={p.id === you.id ? () => handlePreselect(card) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {preselectedCard !== null && (
            <p className="preselect-hint">
              Card {preselectedCard} preselected — will auto-play when choose phase starts
            </p>
          )}
        </div>
      )}

      {/* Choose Phase: pick 1 from your pair */}
      {phase === 'choose' && (
        <div className="active-phase">
          <h3>Choose 1 card to play</h3>
          <p>The other card will be benched for 1 round.</p>
          <div className="cards">
            {you.selectedPair?.map((card) => (
              <Card
                key={card}
                value={card}
                faceUp={true}
                onClick={() => handleCardClick(card)}
              />
            ))}
          </div>
          <div className="other-players-status">
            {players
              .filter((p) => p.id !== you.id)
              .map((p) => (
                <div key={p.id} className="player-status">
                  <span>{p.name}</span>
                  <span className={`status-indicator ${p.hasChosenCard ? 'done' : 'waiting'}`}>
                    {p.hasChosenCard ? 'Chosen' : 'Choosing...'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Resolve Phase: show round results */}
      {phase === 'resolve' && (
        <div className="resolve-phase">
          {(() => {
            const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1];
            if (!lastRound) return null;
            return (
              <>
                <h3>Round {lastRound.round} Results</h3>
                <div className="resolve-grid">
                  {lastRound.playedCards.map((pc) => (
                    <div key={pc.playerId} className="resolve-player">
                      <span>{players.find((p) => p.id === pc.playerId)?.name}</span>
                      <Card value={pc.card} faceUp={true} />
                    </div>
                  ))}
                </div>
                <div className="round-winner">
                  {lastRound.winnerId !== null
                    ? `${players.find((p) => p.id === lastRound.winnerId)?.name} wins ${lastRound.points} points!`
                    : 'No winner this round — no unique card played!'}
                </div>
              </>
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
                .sort((a, b) => b.score - a.score)
                .map((entry, i) => (
                  <div key={entry.playerId} className={`final-score-entry ${i === 0 ? 'winner-row' : ''}`}>
                    <span className="rank">#{i + 1}</span>
                    <span className="player-name">{entry.name}</span>
                    <span className="score">{entry.score} pts</span>
                  </div>
                ))}
            </div>
          )}
          <button className="leave-btn" onClick={onLeaveRoom}>Leave Room</button>
        </div>
      )}

      <ScoreBoard
        players={players}
        roundHistory={gameState.roundHistory}
        isGameOver={phase === 'gameOver'}
      />
    </div>
  );
}
