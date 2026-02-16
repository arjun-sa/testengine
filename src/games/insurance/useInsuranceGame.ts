import { useState, useCallback, useEffect } from 'react';
import { ServerMessage } from '../../shared/types';
import { ClientGameState, GameOverMessage } from './multiplayer/types';

export function useInsuranceGame(
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

        case 'BID_SUBMITTED':
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === m.playerId ? { ...p, hasBid: true } : p
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

        case 'GAME_PAUSED':
          setGameState((prev) => (prev ? { ...prev, paused: true } : prev));
          break;

        case 'GAME_UNPAUSED':
          setGameState((prev) => (prev ? { ...prev, paused: false } : prev));
          break;

        case 'ALL_BIDS_SUBMITTED':
        case 'TIMER_EXPIRED':
          break;
      }
    };

    onGameMessage(handler);
    return () => onGameMessage(null);
  }, [onGameMessage, setScreenToGame]);

  const submitBid = useCallback(
    (healthyPrice: number, sickPrice: number) => {
      send({ type: 'SUBMIT_BID', healthyPrice, sickPrice });
    },
    [send],
  );

  const skipTimer = useCallback(() => {
    send({ type: 'SKIP_TIMER' });
  }, [send]);

  const togglePause = useCallback(() => {
    send({ type: 'TOGGLE_PAUSE' });
  }, [send]);

  const requestState = useCallback(() => {
    send({ type: 'REQUEST_STATE' });
  }, [send]);

  return {
    gameState,
    gameOverData,
    submitBid,
    skipTimer,
    togglePause,
    requestState,
  };
}
