import { GameDefinition, GameComponentProps } from '../types';
import { useCardGame } from './useCardGame';
import { GameBoard } from './components/GameBoard';

function CardGameComponent({ send, onGameMessage, setScreenToGame, isHost, onLeaveRoom }: GameComponentProps) {
  const game = useCardGame(send, onGameMessage, setScreenToGame);

  if (!game.gameState) {
    return <div className="game-loading">Waiting for game to start...</div>;
  }

  return (
    <GameBoard
      gameState={game.gameState}
      gameOverData={game.gameOverData}
      isHost={isHost}
      onSelectPair={game.selectPair}
      onChooseCard={game.chooseCard}
      onSkipTimer={game.skipTimer}
      onLeaveRoom={onLeaveRoom}
    />
  );
}

export const cardGameDefinition: GameDefinition = {
  gameType: 'card-game',
  displayName: 'Lowest Unique Card',
  description: 'Pick 2 cards, reveal, choose 1 to play. The lowest unique number scores!',
  minPlayers: 2,
  maxPlayers: 4,
  GameComponent: CardGameComponent,
};
