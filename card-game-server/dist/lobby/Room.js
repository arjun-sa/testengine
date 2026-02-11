import { GameRoom } from '../game/GameRoom.js';
export class Room {
    onDestroy;
    code;
    hostSessionId;
    createdAt;
    players = [];
    nextPlayerId = 0;
    gameRoom = null;
    destroyTimer = null;
    hardCapTimer;
    // 5 min after last disconnect, 30 min after game over, 2 hour hard cap
    static EMPTY_TIMEOUT_MS = 5 * 60 * 1000;
    static POST_GAME_TIMEOUT_MS = 30 * 60 * 1000;
    static HARD_CAP_MS = 2 * 60 * 60 * 1000;
    constructor(code, hostSessionId, onDestroy) {
        this.onDestroy = onDestroy;
        this.code = code;
        this.hostSessionId = hostSessionId;
        this.createdAt = Date.now();
        this.hardCapTimer = setTimeout(() => {
            this.destroy('Room expired (2 hour limit)');
        }, Room.HARD_CAP_MS);
    }
    addPlayer(sessionId, name) {
        if (this.players.length >= 4)
            return null;
        if (this.gameRoom)
            return null; // Game already in progress
        if (this.players.some((p) => p.name === name))
            return null;
        const player = {
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
    removePlayer(sessionId) {
        const idx = this.players.findIndex((p) => p.sessionId === sessionId);
        if (idx === -1)
            return null;
        const player = this.players[idx];
        this.players.splice(idx, 1);
        if (this.players.length === 0) {
            this.scheduleDestroy(Room.EMPTY_TIMEOUT_MS, 'All players left');
        }
        return player;
    }
    setPlayerConnected(sessionId, connected) {
        const player = this.players.find((p) => p.sessionId === sessionId);
        if (!player)
            return null;
        player.connected = connected;
        if (!connected) {
            const connectedCount = this.players.filter((p) => p.connected).length;
            if (connectedCount === 0) {
                this.scheduleDestroy(Room.EMPTY_TIMEOUT_MS, 'All players disconnected');
            }
        }
        else {
            this.cancelDestroyTimer();
        }
        return player;
    }
    setReady(sessionId, ready) {
        const player = this.players.find((p) => p.sessionId === sessionId);
        if (!player)
            return null;
        if (this.gameRoom)
            return null; // Can't toggle ready during game
        player.ready = ready;
        return player;
    }
    canStart() {
        if (this.players.length < 2)
            return { ok: false, reason: 'Need at least 2 players' };
        if (!this.players.every((p) => p.ready))
            return { ok: false, reason: 'Not all players are ready' };
        return { ok: true };
    }
    isHost(sessionId) {
        return this.hostSessionId === sessionId;
    }
    startGame() {
        const playerNames = this.players.map((p) => ({ id: p.id, name: p.name }));
        this.gameRoom = new GameRoom(playerNames);
        return this.gameRoom;
    }
    getGameRoom() {
        return this.gameRoom;
    }
    getPlayer(sessionId) {
        return this.players.find((p) => p.sessionId === sessionId) ?? null;
    }
    getPlayerById(playerId) {
        return this.players.find((p) => p.id === playerId) ?? null;
    }
    getPlayers() {
        return this.players;
    }
    getLobbyPlayers() {
        return this.players.map((p) => ({
            id: p.id,
            name: p.name,
            ready: p.ready,
            connected: p.connected,
        }));
    }
    getConnectedSessionIds() {
        return this.players.filter((p) => p.connected).map((p) => p.sessionId);
    }
    getAllSessionIds() {
        return this.players.map((p) => p.sessionId);
    }
    onGameOver() {
        this.scheduleDestroy(Room.POST_GAME_TIMEOUT_MS, 'Game ended');
    }
    scheduleDestroy(timeoutMs, reason) {
        this.cancelDestroyTimer();
        this.destroyTimer = setTimeout(() => {
            this.destroy(reason);
        }, timeoutMs);
    }
    cancelDestroyTimer() {
        if (this.destroyTimer) {
            clearTimeout(this.destroyTimer);
            this.destroyTimer = null;
        }
    }
    destroy(_reason) {
        this.cancelDestroyTimer();
        clearTimeout(this.hardCapTimer);
        if (this.gameRoom) {
            this.gameRoom.cleanup();
        }
        this.onDestroy(this.code);
    }
    get playerCount() {
        return this.players.length;
    }
    get hasGame() {
        return this.gameRoom !== null;
    }
}
//# sourceMappingURL=Room.js.map