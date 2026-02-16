import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ConnectionStatus,
  Screen,
  LobbyPlayer,
  ServerMessage,
} from './types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
const SESSION_KEY = 'mp_session_id';
const HEARTBEAT_INTERVAL = 25_000;
const MAX_BACKOFF = 30_000;

const LOBBY_TYPES = new Set([
  'SESSION_ESTABLISHED', 'ROOM_CREATED', 'ROOM_JOINED',
  'PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_READY',
  'ROOM_CLOSED', 'ERROR', 'PONG',
]);

export function useMultiplayerConnection() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [screen, setScreen] = useState<Screen>('home');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [gameType, setGameType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Game messages are forwarded to game hooks via this callback
  const onGameMessageRef = useRef<((msg: ServerMessage) => void) | null>(null);
  const pendingGameMessagesRef = useRef<ServerMessage[]>([]);

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

    const msgType = (msg as { type: string }).type;

    // Handle lobby messages
    if (LOBBY_TYPES.has(msgType)) {
      switch (msgType) {
        case 'SESSION_ESTABLISHED':
          localStorage.setItem(SESSION_KEY, (msg as any).sessionId);
          break;

        case 'ROOM_CREATED':
          setRoomCode((msg as any).roomCode);
          setPlayerId((msg as any).playerId);
          setIsHost(true);
          setGameType((msg as any).gameType);
          setLobbyPlayers([{ id: (msg as any).playerId, name: '', ready: false, connected: true }]);
          setScreen('lobby');
          break;

        case 'ROOM_JOINED':
          setRoomCode((msg as any).roomCode);
          setPlayerId((msg as any).playerId);
          setIsHost(false);
          setGameType((msg as any).gameType);
          setLobbyPlayers((msg as any).players);
          setScreen('lobby');
          break;

        case 'PLAYER_JOINED':
          setLobbyPlayers((prev) => [...prev, (msg as any).player]);
          break;

        case 'PLAYER_LEFT':
          setLobbyPlayers((prev) => prev.filter((p) => p.id !== (msg as any).playerId));
          break;

        case 'PLAYER_READY':
          setLobbyPlayers((prev) =>
            prev.map((p) => (p.id === (msg as any).playerId ? { ...p, ready: (msg as any).ready } : p))
          );
          break;

        case 'ROOM_CLOSED':
          setScreen('home');
          setRoomCode(null);
          setPlayerId(null);
          setIsHost(false);
          setLobbyPlayers([]);
          setGameType(null);
          setError(`Room closed: ${(msg as any).reason}`);
          setTimeout(clearError, 5000);
          break;

        case 'ERROR':
          setError((msg as any).message);
          setTimeout(clearError, 5000);
          break;

        case 'PONG':
          break;
      }
    } else {
      // Game-specific message — forward to game hook
      // GAME_STARTED must switch screen so GameComponent mounts
      if (msgType === 'GAME_STARTED') {
        setScreen('game');
      }
      if (onGameMessageRef.current) {
        onGameMessageRef.current(msg);
      } else {
        // Buffer until game hook registers (e.g. GAME_STARTED before GameComponent mounts)
        pendingGameMessagesRef.current.push(msg);
      }
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

  // ── Lobby Actions ──

  const createRoom = useCallback(
    (playerName: string, selectedGameType: string = 'card-game') => {
      send({ type: 'CREATE_ROOM', playerName, gameType: selectedGameType });
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
    setGameType(null);
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

  // Allow game hooks to register for game messages
  const setOnGameMessage = useCallback((handler: ((msg: ServerMessage) => void) | null) => {
    onGameMessageRef.current = handler;
    // Replay any messages that arrived before the handler registered
    if (handler && pendingGameMessagesRef.current.length > 0) {
      const pending = pendingGameMessagesRef.current;
      pendingGameMessagesRef.current = [];
      for (const msg of pending) {
        handler(msg);
      }
    }
  }, []);

  // Allow game to transition to game screen
  const setScreenToGame = useCallback(() => {
    setScreen('game');
  }, []);

  return {
    connectionStatus,
    screen,
    roomCode,
    playerId,
    isHost,
    lobbyPlayers,
    gameType,
    error,
    send,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    setOnGameMessage,
    setScreenToGame,
  };
}
