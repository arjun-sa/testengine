import { GameRoom } from '../game/GameRoom.js';
import { LobbyPlayer } from '../shared/messages.js';

export interface RoomPlayer {
  id: number;
  sessionId: string;
  name: string;
  ready: boolean;
  connected: boolean;
}

export class Room {
  readonly code: string;
  readonly hostSessionId: string;
  readonly createdAt: number;
  private players: RoomPlayer[] = [];
  private nextPlayerId = 0;
  private gameRoom: GameRoom | null = null;
  private destroyTimer: ReturnType<typeof setTimeout> | null = null;
  private hardCapTimer: ReturnType<typeof setTimeout>;

  // 5 min after last disconnect, 30 min after game over, 2 hour hard cap
  private static EMPTY_TIMEOUT_MS = 5 * 60 * 1000;
  private static POST_GAME_TIMEOUT_MS = 30 * 60 * 1000;
  private static HARD_CAP_MS = 2 * 60 * 60 * 1000;

  constructor(code: string, hostSessionId: string, private onDestroy: (code: string) => void) {
    this.code = code;
    this.hostSessionId = hostSessionId;
    this.createdAt = Date.now();

    this.hardCapTimer = setTimeout(() => {
      this.destroy('Room expired (2 hour limit)');
    }, Room.HARD_CAP_MS);
  }

  addPlayer(sessionId: string, name: string): RoomPlayer | null {
    if (this.players.length >= 4) return null;
    if (this.gameRoom) return null; // Game already in progress
    if (this.players.some((p) => p.name === name)) return null;

    const player: RoomPlayer = {
      id: this.nextPlayerId++,
      sessionId,
      name,
      ready: false,
      connected: true,
    };
    this.players.push(player);
    this.cancelDestroyTimer();
    return player;
  }

  removePlayer(sessionId: string): RoomPlayer | null {
    const idx = this.players.findIndex((p) => p.sessionId === sessionId);
    if (idx === -1) return null;

    const player = this.players[idx];
    this.players.splice(idx, 1);

    if (this.players.length === 0) {
      this.scheduleDestroy(Room.EMPTY_TIMEOUT_MS, 'All players left');
    }

    return player;
  }

  setPlayerConnected(sessionId: string, connected: boolean): RoomPlayer | null {
    const player = this.players.find((p) => p.sessionId === sessionId);
    if (!player) return null;
    player.connected = connected;

    if (!connected) {
      const connectedCount = this.players.filter((p) => p.connected).length;
      if (connectedCount === 0) {
        this.destroy('All players disconnected');
      }
    } else {
      this.cancelDestroyTimer();
    }

    return player;
  }

  setReady(sessionId: string, ready: boolean): RoomPlayer | null {
    const player = this.players.find((p) => p.sessionId === sessionId);
    if (!player) return null;
    if (this.gameRoom) return null; // Can't toggle ready during game
    player.ready = ready;
    return player;
  }

  canStart(): { ok: boolean; reason?: string } {
    if (this.players.length < 2) return { ok: false, reason: 'Need at least 2 players' };
    if (!this.players.every((p) => p.ready)) return { ok: false, reason: 'Not all players are ready' };
    return { ok: true };
  }

  isHost(sessionId: string): boolean {
    return this.hostSessionId === sessionId;
  }

  startGame(): GameRoom {
    const playerNames = this.players.map((p) => ({ id: p.id, name: p.name }));
    this.gameRoom = new GameRoom(playerNames);
    return this.gameRoom;
  }

  getGameRoom(): GameRoom | null {
    return this.gameRoom;
  }

  getPlayer(sessionId: string): RoomPlayer | null {
    return this.players.find((p) => p.sessionId === sessionId) ?? null;
  }

  getPlayerById(playerId: number): RoomPlayer | null {
    return this.players.find((p) => p.id === playerId) ?? null;
  }

  getPlayers(): readonly RoomPlayer[] {
    return this.players;
  }

  getLobbyPlayers(): LobbyPlayer[] {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      connected: p.connected,
    }));
  }

  getConnectedSessionIds(): string[] {
    return this.players.filter((p) => p.connected).map((p) => p.sessionId);
  }

  getAllSessionIds(): string[] {
    return this.players.map((p) => p.sessionId);
  }

  onGameOver(): void {
    this.scheduleDestroy(Room.POST_GAME_TIMEOUT_MS, 'Game ended');
  }

  private scheduleDestroy(timeoutMs: number, reason: string): void {
    this.cancelDestroyTimer();
    this.destroyTimer = setTimeout(() => {
      this.destroy(reason);
    }, timeoutMs);
  }

  private cancelDestroyTimer(): void {
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }
  }

  destroy(_reason: string): void {
    this.cancelDestroyTimer();
    clearTimeout(this.hardCapTimer);
    if (this.gameRoom) {
      this.gameRoom.cleanup();
    }
    this.onDestroy(this.code);
  }

  get playerCount(): number {
    return this.players.length;
  }

  get hasGame(): boolean {
    return this.gameRoom !== null;
  }
}
