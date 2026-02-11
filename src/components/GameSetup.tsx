import { useState } from 'react';

interface GameSetupProps {
  onStartGame: (playerCount: number) => void;
}

export function GameSetup({ onStartGame }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState(2);

  return (
    <div className="game-setup">
      <h1>Lowest Unique Card Game</h1>
      <p>Pick 2 cards, reveal, choose 1 to play. The lowest unique number scores!</p>
      <div className="setup-controls">
        <label>
          Players:
          <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            <option value={2}>2 Players</option>
            <option value={3}>3 Players</option>
            <option value={4}>4 Players</option>
          </select>
        </label>
        <button className="start-btn" onClick={() => onStartGame(playerCount)}>
          Start Game
        </button>
      </div>
    </div>
  );
}
