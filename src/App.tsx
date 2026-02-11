import { useGameEngine } from './hooks/useGameEngine';
import { GameSetup } from './components/GameSetup';
import { GameBoard } from './components/GameBoard';

export default function App() {
  const engine = useGameEngine();

  if (!engine.state) {
    return <GameSetup onStartGame={engine.initGame} />;
  }

  return (
    <GameBoard
      state={engine.state}
      showPassScreen={engine.showPassScreen}
      onSelectPair={engine.selectPair}
      onChooseCard={engine.chooseCard}
      onAdvancePhase={engine.advancePhase}
      onDismissPassScreen={engine.dismissPassScreen}
      onResetGame={engine.resetGame}
    />
  );
}
