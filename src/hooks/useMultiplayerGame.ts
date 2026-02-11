import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ClientGameState,
  LobbyPlayer,
  ServerMessage,
  GameOverMessage,
} from '../multiplayer/types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export type Screen = 'home' | 'lobby' | 'game';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
const SESSION_KEY = 'mp_session_id';
const HEARTBEAT_INTERVAL = 25_000;
const MAX_BACKOFF = 30_000;

export function useMultiplayerGame() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [screen, setScreen] = useState<Screen>('home');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      send({ type: 'PING' });
    }, HEARTBEAT_INTERVAL);
  }, [send]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'SESSION_ESTABLISHED':
        localStorage.setItem(SESSION_KEY, msg.sessionId);
        break;

      case 'ROOM_CREATED':
        setRoomCode(msg.roomCode);
        setPlayerId(msg.playerId);
        setIsHost(true);
        setLobbyPlayers([{ id: msg.playerId, name: '', ready: false, connected: true }]);
        setScreen('lobby');
        break;

      case 'ROOM_JOINED':
        setRoomCode(msg.roomCode);
        setPlayerId(msg.playerId);
        setIsHost(false);
        setLobbyPlayers(msg.players);
        setScreen('lobby');
        break;

      case 'PLAYER_JOINED':
        setLobbyPlayers((prev) => [...prev, msg.player]);
        break;

      case 'PLAYER_LEFT':
        setLobbyPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
        break;

      case 'PLAYER_READY':
        setLobbyPlayers((prev) =>
          prev.map((p) => (p.id === msg.playerId ? { ...p, ready: msg.ready } : p))
        );
        break;

      case 'ROOM_CLOSED':
        setScreen('home');
        setRoomCode(null);
        setPlayerId(null);
        setIsHost(false);
        setLobbyPlayers([]);
        setGameState(null);
        setGameOverData(null);
        setError(`Room closed: ${msg.reason}`);
        break;

      case 'GAME_STARTED':
      case 'STATE_UPDATE':
      case 'PHASE_CHANGED':
        setGameState(msg.state);
        setGameOverData(null);
        setScreen('game');
        break;

      case 'PAIR_SELECTED':
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === msg.playerId ? { ...p, hasSelectedPair: true } : p
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
              p.id === msg.playerId ? { ...p, hasChosenCard: true } : p
            ),
          };
        });
        break;

      case 'ROUND_RESULT':
        setGameState(msg.state);
        break;

      case 'GAME_OVER':
        setGameState(msg.state);
        setGameOverData(msg);
        break;

      case 'TIMER_TICK':
        setGameState((prev) => (prev ? { ...prev, timer: msg.timer } : prev));
        break;

      case 'ERROR':
        setError(msg.message);
        setTimeout(clearError, 5000);
        break;

      case 'PONG':
      case 'ALL_PAIRS_SELECTED':
      case 'ALL_CARDS_CHOSEN':
      case 'TIMER_EXPIRED':
        // No-op — state updates come via STATE_UPDATE/PHASE_CHANGED
        break;
    }
  }, [clearError]);

  const connect = useCallback(() => {
    // Close any lingering socket (e.g. from StrictMode remount)
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) return;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current = null;
    }

    const savedSession = localStorage.getItem(SESSION_KEY);
    const url = savedSession ? `${WS_URL}?session=${savedSession}` : WS_URL;

    setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return; // stale socket
      setConnectionStatus('connected');
      reconnectAttemptRef.current = 0;
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return; // stale socket
      handleMessage(event);
    };

    ws.onclose = () => {
      stopHeartbeat();
      // If a newer connection already replaced this one, do nothing
      if (wsRef.current !== ws) return;
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        setConnectionStatus('disconnected');
        intentionalCloseRef.current = false;
        return;
      }

      setConnectionStatus('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), MAX_BACKOFF);
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after this — reconnect handled there
    };
  }, [handleMessage, startHeartbeat, stopHeartbeat]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect, stopHeartbeat]);

  // ── Actions ──

  const createRoom = useCallback(
    (playerName: string) => {
      send({ type: 'CREATE_ROOM', playerName });
    },
    [send]
  );

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      send({ type: 'JOIN_ROOM', roomCode: code.toUpperCase(), playerName });
    },
    [send]
  );

  const leaveRoom = useCallback(() => {
    send({ type: 'LEAVE_ROOM' });
    setScreen('home');
    setRoomCode(null);
    setPlayerId(null);
    setIsHost(false);
    setLobbyPlayers([]);
    setGameState(null);
    setGameOverData(null);
  }, [send]);

  const setReady = useCallback(
    (ready: boolean) => {
      send({ type: 'SET_READY', ready });
    },
    [send]
  );

  const startGame = useCallback(() => {
    send({ type: 'START_GAME' });
  }, [send]);

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
    connectionStatus,
    screen,
    roomCode,
    playerId,
    isHost,
    lobbyPlayers,
    gameState,
    gameOverData,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    selectPair,
    chooseCard,
    skipTimer,
    requestState,
  };
}
