import { GameRoom } from '../game/GameRoom.js';
import { LobbyPlayer } from '../shared/messages.js';
export interface RoomPlayer {
    id: number;
    sessionId: string;
    name: string;
    ready: boolean;
    connected: boolean;
}
export declare class Room {
    private onDestroy;
    readonly code: string;
    readonly hostSessionId: string;
    readonly createdAt: number;
    private players;
    private nextPlayerId;
    private gameRoom;
    private destroyTimer;
    private hardCapTimer;
    private static EMPTY_TIMEOUT_MS;
    private static POST_GAME_TIMEOUT_MS;
    private static HARD_CAP_MS;
    constructor(code: string, hostSessionId: string, onDestroy: (code: string) => void);
    addPlayer(sessionId: string, name: string): RoomPlayer | null;
    removePlayer(sessionId: string): RoomPlayer | null;
    setPlayerConnected(sessionId: string, connected: boolean): RoomPlayer | null;
    setReady(sessionId: string, ready: boolean): RoomPlayer | null;
    canStart(): {
        ok: boolean;
        reason?: string;
    };
    isHost(sessionId: string): boolean;
    startGame(): GameRoom;
    getGameRoom(): GameRoom | null;
    getPlayer(sessionId: string): RoomPlayer | null;
    getPlayerById(playerId: number): RoomPlayer | null;
    getPlayers(): readonly RoomPlayer[];
    getLobbyPlayers(): LobbyPlayer[];
    getConnectedSessionIds(): string[];
    getAllSessionIds(): string[];
    onGameOver(): void;
    private scheduleDestroy;
    private cancelDestroyTimer;
    destroy(_reason: string): void;
    get playerCount(): number;
    get hasGame(): boolean;
}
//# sourceMappingURL=Room.d.ts.map