import { useMultiplayerConnection } from './shared/useMultiplayerConnection';
import { Lobby } from './lobby/Lobby';
import { getGameDefinition } from './games/registry';

export default function App() {
  const mp = useMultiplayerConnection();

  const gameDef = mp.gameType ? getGameDefinition(mp.gameType) : undefined;

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
          gameType={mp.gameType ?? 'card-game'}
          onSetReady={mp.setReady}
          onStartGame={mp.startGame}
          onLeaveRoom={mp.leaveRoom}
        />
      )}

      {mp.screen === 'game' && gameDef && mp.playerId !== null && (
        <gameDef.GameComponent
          send={mp.send}
          onGameMessage={mp.setOnGameMessage}
          setScreenToGame={mp.setScreenToGame}
          isHost={mp.isHost}
          playerId={mp.playerId}
          onLeaveRoom={mp.leaveRoom}
        />
      )}
    </div>
  );
}
