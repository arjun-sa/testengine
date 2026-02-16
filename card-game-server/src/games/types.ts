export interface GameRoomCallbacks {
  broadcast: (sessionIds: string[], message: object) => void;
  sendToPlayer: (sessionId: string, message: object) => void;
  getConnectedSessionIds: () => string[];
  getPlayerSessionId: (playerId: number) => string | null;
  getAllSessionIds: () => string[];
  onGameOver: () => void;
}

export interface GameRoomInstance {
  setCallbacks(callbacks: GameRoomCallbacks): void;
  broadcastGameStarted(): void;
  handleAction(playerId: number, sessionId: string, message: { type: string; [key: string]: unknown }): void;
  sendStateToPlayer(playerId: number, sessionId: string): void;
  handlePlayerDisconnect(playerId: number): void;
  handlePlayerReconnect(playerId: number, sessionId: string): void;
  cleanup(): void;
}

export interface GameAdapter {
  gameType: string;
  minPlayers: number;
  maxPlayers: number;
  createGameRoom(players: { id: number; name: string }[]): GameRoomInstance;
  validateAction(raw: unknown): { ok: true; message: { type: string; [key: string]: unknown } } | { ok: false; error: string };
  getActionTypes(): string[];
}
