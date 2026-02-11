import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState } from '../engine/types';
import {
  createGame,
  selectPair,
  allPairsSelected,
  startReveal,
  tickTimer,
  startChoose,
  chooseCard,
  allCardsChosen,
  resolveRound,
  startNextRound,
} from '../engine/gameEngine';

export function useGameEngine() {
  const [state, setState] = useState<GameState | null>(null);
  const [showPassScreen, setShowPassScreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Reveal phase timer
  useEffect(() => {
    if (!state || state.phase !== 'reveal') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || prev.phase !== 'reveal') return prev;
        const next = tickTimer(prev);
        if (next.timer <= 0) {
          return startChoose(next);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state?.phase]);

  const initGame = useCallback((playerCount: number) => {
    setState(createGame(playerCount));
    setShowPassScreen(false);
  }, []);

  const doSelectPair = useCallback((playerId: number, cards: [number, number]) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = selectPair(prev, playerId, cards);
      if (allPairsSelected(next)) {
        return startReveal(next);
      }
      return next;
    });
    setShowPassScreen(true);
  }, []);

  const doChooseCard = useCallback((playerId: number, card: number) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = chooseCard(prev, playerId, card);
      if (allCardsChosen(next)) {
        return resolveRound(next);
      }
      return next;
    });
    setShowPassScreen(true);
  }, []);

  const advancePhase = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      if (prev.phase === 'reveal') return startChoose(prev);
      if (prev.phase === 'resolve') return startNextRound(prev);
      return prev;
    });
  }, []);

  const dismissPassScreen = useCallback(() => {
    setShowPassScreen(false);
  }, []);

  const resetGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState(null);
    setShowPassScreen(false);
  }, []);

  return {
    state,
    showPassScreen,
    initGame,
    selectPair: doSelectPair,
    chooseCard: doChooseCard,
    advancePhase,
    dismissPassScreen,
    resetGame,
  };
}
