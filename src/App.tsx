import { useMultiplayerGame } from './hooks/useMultiplayerGame';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

export default function App() {
  const mp = useMultiplayerGame();

  return (
    <div className="app">
      <div className={`connection-status connection-${mp.connectionStatus}`}>
        {mp.connectionStatus === 'connected' && 'Connected'}
        {mp.connectionStatus === 'connecting' && 'Connecting...'}
        {mp.connectionStatus === 'reconnecting' && 'Reconnecting...'}
        {mp.connectionStatus === 'disconnected' && 'Disconnected'}
      </div>

      {mp.error && <div className="error-toast">{mp.error}</div>}

      {mp.screen === 'home' && (
        <Lobby
          mode="home"
          connectionStatus={mp.connectionStatus}
          onCreateRoom={mp.createRoom}
          onJoinRoom={mp.joinRoom}
        />
      )}

      {mp.screen === 'lobby' && (
        <Lobby
          mode="waiting"
          connectionStatus={mp.connectionStatus}
          roomCode={mp.roomCode!}
          playerId={mp.playerId!}
          isHost={mp.isHost}
          players={mp.lobbyPlayers}
          onSetReady={mp.setReady}
          onStartGame={mp.startGame}
          onLeaveRoom={mp.leaveRoom}
        />
      )}

      {mp.screen === 'game' && mp.gameState && (
        <GameBoard
          gameState={mp.gameState}
          gameOverData={mp.gameOverData}
          isHost={mp.isHost}
          onSelectPair={mp.selectPair}
          onChooseCard={mp.chooseCard}
          onSkipTimer={mp.skipTimer}
          onLeaveRoom={mp.leaveRoom}
        />
      )}
    </div>
  );
}
