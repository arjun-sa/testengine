import { useState } from 'react';
import { LobbyPlayer } from '../multiplayer/types';
import { ConnectionStatus } from '../hooks/useMultiplayerGame';

type HomeProps = {
  mode: 'home';
  connectionStatus: ConnectionStatus;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
};

type WaitingProps = {
  mode: 'waiting';
  connectionStatus: ConnectionStatus;
  roomCode: string;
  playerId: number;
  isHost: boolean;
  players: LobbyPlayer[];
  onSetReady: (ready: boolean) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
};

type LobbyProps = HomeProps | WaitingProps;

export function Lobby(props: LobbyProps) {
  if (props.mode === 'home') {
    return <HomeScreen {...props} />;
  }
  return <WaitingRoom {...props} />;
}

function HomeScreen({ connectionStatus, onCreateRoom, onJoinRoom }: HomeProps) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  const disabled = connectionStatus !== 'connected';

  return (
    <div className="lobby lobby-home">
      <h1>Lowest Unique Card Game</h1>
      <p>Pick 2 cards, reveal, choose 1 to play. The lowest unique number scores!</p>

      <div className="lobby-forms">
        <div className="lobby-form">
          <h3>Create Room</h3>
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
          />
          <button
            className="start-btn"
            disabled={disabled || !playerName.trim()}
            onClick={() => onCreateRoom(playerName.trim())}
          >
            Create Room
          </button>
        </div>

        <div className="lobby-divider">or</div>

        <div className="lobby-form">
          <h3>Join Room</h3>
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <input
            type="text"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={20}
          />
          <button
            className="start-btn"
            disabled={disabled || !joinCode.trim() || !joinName.trim()}
            onClick={() => onJoinRoom(joinCode.trim(), joinName.trim())}
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}

function WaitingRoom({ roomCode, playerId, isHost, players, onSetReady, onStartGame, onLeaveRoom }: WaitingProps) {
  const self = players.find((p) => p.id === playerId);
  const allReady = players.length >= 2 && players.every((p) => p.ready);

  return (
    <div className="lobby lobby-waiting">
      <div className="room-code-section">
        <span className="room-code-label">Room Code</span>
        <span className="room-code">{roomCode}</span>
      </div>

      <div className="player-list">
        <h3>Players ({players.length}/4)</h3>
        {players.map((p) => (
          <div key={p.id} className="player-list-item">
            <span className={`status-dot ${p.ready ? 'dot-ready' : 'dot-waiting'}`} />
            <span className="player-name">
              {p.name || '(you)'}
              {p.id === playerId && ' (you)'}
              {!p.connected && ' (disconnected)'}
            </span>
            {p.ready && <span className="ready-badge">Ready</span>}
          </div>
        ))}
      </div>

      <div className="lobby-actions">
        <button
          className={`ready-btn ${self?.ready ? 'ready-active' : ''}`}
          onClick={() => onSetReady(!self?.ready)}
        >
          {self?.ready ? 'Not Ready' : 'Ready'}
        </button>

        {isHost && (
          <button
            className="start-btn"
            disabled={!allReady}
            onClick={onStartGame}
          >
            Start Game
          </button>
        )}

        <button className="leave-btn" onClick={onLeaveRoom}>
          Leave Room
        </button>
      </div>
    </div>
  );
}
