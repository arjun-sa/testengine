import { useState, useCallback, useEffect } from 'react';
import { ServerMessage } from '../../shared/types';
import { ClientGameState, GameOverMessage } from './multiplayer/types';

export function useCardGame(
  send: (msg: object) => void,
  onGameMessage: (handler: ((msg: ServerMessage) => void) | null) => void,
  setScreenToGame: () => void,
) {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverMessage | null>(null);

  useEffect(() => {
    const handler = (msg: ServerMessage) => {
      const m = msg as { type: string; [key: string]: any };
      switch (m.type) {
        case 'GAME_STARTED':
        case 'STATE_UPDATE':
        case 'PHASE_CHANGED':
          setGameState(m.state);
          setGameOverData(null);
          setScreenToGame();
          break;

        case 'PAIR_SELECTED':
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === m.playerId ? { ...p, hasSelectedPair: true } : p
              ),
            };
          });
          break;

        case 'CARD_CHOSEN':
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === m.playerId ? { ...p, hasChosenCard: true } : p
              ),
            };
          });
          break;

        case 'ROUND_RESULT':
          setGameState(m.state);
          break;

        case 'GAME_OVER':
          setGameState(m.state);
          setGameOverData(m as GameOverMessage);
          break;

        case 'TIMER_TICK':
          setGameState((prev) => (prev ? { ...prev, timer: m.timer } : prev));
          break;

        case 'ALL_PAIRS_SELECTED':
        case 'ALL_CARDS_CHOSEN':
        case 'TIMER_EXPIRED':
          // No-op — state updates come via STATE_UPDATE/PHASE_CHANGED
          break;
      }
    };

    onGameMessage(handler);
    return () => onGameMessage(null);
  }, [onGameMessage, setScreenToGame]);

  const selectPair = useCallback(
    (cards: [number, number]) => {
      send({ type: 'SELECT_PAIR', cards });
    },
    [send]
  );

  const chooseCard = useCallback(
    (card: number) => {
      send({ type: 'CHOOSE_CARD', card });
    },
    [send]
  );

  const skipTimer = useCallback(() => {
    send({ type: 'SKIP_TIMER' });
  }, [send]);

  const requestState = useCallback(() => {
    send({ type: 'REQUEST_STATE' });
  }, [send]);

  return {
    gameState,
    gameOverData,
    selectPair,
    chooseCard,
    skipTimer,
    requestState,
  };
}
