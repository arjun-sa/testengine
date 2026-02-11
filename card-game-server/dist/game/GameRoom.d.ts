import { GameState } from '../engine/types.js';
import { ServerMessage } from '../shared/messages.js';
interface GameRoomCallbacks {
    broadcast: (sessionIds: string[], message: ServerMessage) => void;
    sendToPlayer: (sessionId: string, message: ServerMessage) => void;
    getConnectedSessionIds: () => string[];
    getPlayerSessionId: (playerId: number) => string | null;
    getAllSessionIds: () => string[];
    onGameOver: () => void;
}
interface PlayerInfo {
    id: number;
    name: string;
}
export declare class GameRoom {
    private state;
    private callbacks;
    private timerManager;
    private disconnectedTimers;
    private connectedPlayerIds;
    private playerInfoMap;
    constructor(players: PlayerInfo[]);
    setCallbacks(callbacks: GameRoomCallbacks): void;
    broadcastGameStarted(): void;
    handleSelectPair(playerId: number, sessionId: string, cards: [number, number]): void;
    handleChooseCard(playerId: number, sessionId: string, card: number): void;
    sendStateToPlayer(playerId: number, sessionId: string): void;
    handlePlayerDisconnect(playerId: number): void;
    handlePlayerReconnect(playerId: number, sessionId: string): void;
    cleanup(): void;
    getState(): GameState;
    private transitionToReveal;
    private transitionToChoose;
    private transitionToResolve;
    private autoPlayForPlayer;
    private scheduleAutoPlayForDisconnected;
    private broadcastPhaseChange;
    private broadcastToAll;
    private sendError;
}
export {};
//# sourceMappingURL=GameRoom.d.ts.map