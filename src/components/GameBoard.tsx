import { useState } from 'react';
import { GameState } from '../engine/types';
import { PlayerHand } from './PlayerHand';
import { PhaseDisplay } from './PhaseDisplay';
import { ScoreBoard } from './ScoreBoard';
import { Card } from './Card';

interface GameBoardProps {
  state: GameState;
  showPassScreen: boolean;
  onSelectPair: (playerId: number, cards: [number, number]) => void;
  onChooseCard: (playerId: number, card: number) => void;
  onAdvancePhase: () => void;
  onDismissPassScreen: () => void;
  onResetGame: () => void;
}

export function GameBoard({
  state,
  showPassScreen,
  onSelectPair,
  onChooseCard,
  onAdvancePhase,
  onDismissPassScreen,
  onResetGame,
}: GameBoardProps) {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const activePlayer = state.players[state.activePlayerIndex];

  // Pass screen between players in hot-seat mode
  if (showPassScreen && (state.phase === 'select' || state.phase === 'choose') && state.activePlayerIndex < state.players.length) {
    return (
      <div className="pass-screen">
        <h2>Pass the device to {activePlayer.name}</h2>
        <button className="ready-btn" onClick={() => {
          onDismissPassScreen();
          setSelectedCards([]);
        }}>
          I'm {activePlayer.name} - Ready!
        </button>
      </div>
    );
  }

  const handleCardClick = (card: number) => {
    if (state.phase === 'select') {
      setSelectedCards((prev) => {
        if (prev.includes(card)) return prev.filter((c) => c !== card);
        if (prev.length >= 2) return prev;
        return [...prev, card];
      });
    } else if (state.phase === 'choose') {
      onChooseCard(activePlayer.id, card);
      setSelectedCards([]);
    }
  };

  const handleConfirmPair = () => {
    if (selectedCards.length === 2) {
      onSelectPair(activePlayer.id, selectedCards as [number, number]);
      setSelectedCards([]);
    }
  };

  return (
    <div className="game-board">
      <PhaseDisplay
        phase={state.phase}
        currentRound={Math.min(state.currentRound, state.totalRounds)}
        totalRounds={state.totalRounds}
        timer={state.timer}
        onSkipTimer={onAdvancePhase}
      />

      {/* Select Phase: show active player's hand */}
      {state.phase === 'select' && activePlayer && (
        <div className="active-phase">
          <PlayerHand
            player={activePlayer}
            phase={state.phase}
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
        </div>
      )}

      {/* Reveal Phase: show all players' selected pairs */}
      {state.phase === 'reveal' && (
        <div className="reveal-phase">
          <h3>All Selected Pairs</h3>
          <div className="reveal-grid">
            {state.players.map((p) => (
              <div key={p.id} className="reveal-player">
                <h4>{p.name}</h4>
                <div className="cards">
                  {p.selectedPair?.map((card) => (
                    <Card key={card} value={card} faceUp={true} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Choose Phase: active player picks 1 from their pair */}
      {state.phase === 'choose' && activePlayer && (
        <div className="active-phase">
          <h3>{activePlayer.name}: Choose 1 card to play</h3>
          <p>The other card will be benched for 1 round.</p>
          <div className="cards">
            {activePlayer.selectedPair?.map((card) => (
              <Card
                key={card}
                value={card}
                faceUp={true}
                onClick={() => handleCardClick(card)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolve Phase: show round results */}
      {state.phase === 'resolve' && (
        <div className="resolve-phase">
          {(() => {
            const lastRound = state.roundHistory[state.roundHistory.length - 1];
            if (!lastRound) return null;
            return (
              <>
                <h3>Round {lastRound.round} Results</h3>
                <div className="resolve-grid">
                  {lastRound.playedCards.map((pc) => (
                    <div key={pc.playerId} className="resolve-player">
                      <span>{state.players.find((p) => p.id === pc.playerId)?.name}</span>
                      <Card value={pc.card} faceUp={true} />
                    </div>
                  ))}
                </div>
                <div className="round-winner">
                  {lastRound.winnerId !== null
                    ? `${state.players.find((p) => p.id === lastRound.winnerId)?.name} wins ${lastRound.points} points with card ${lastRound.points}!`
                    : 'No winner this round — no unique card played!'}
                </div>
                <button className="next-round-btn" onClick={onAdvancePhase}>
                  Next Round
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <button className="start-btn" onClick={onResetGame}>Play Again</button>
        </div>
      )}

      <ScoreBoard
        players={state.players}
        roundHistory={state.roundHistory}
        isGameOver={state.phase === 'gameOver'}
      />
    </div>
  );
}
