import { Room } from './Room.js';
import { Connection, ConnectionManager } from '../server/ConnectionManager.js';
import { ClientMessage } from '../shared/messages.js';
export declare class LobbyManager {
    private connectionManager;
    private maxRooms;
    private rooms;
    constructor(connectionManager: ConnectionManager, maxRooms?: number);
    createRoom(connection: Connection, playerName: string): void;
    joinRoom(connection: Connection, roomCode: string, playerName: string): void;
    leaveRoom(connection: Connection): void;
    setReady(connection: Connection, ready: boolean): void;
    startGame(connection: Connection): void;
    handleGameAction(connection: Connection, message: ClientMessage): void;
    handleDisconnect(connection: Connection): void;
    handleReconnect(connection: Connection): void;
    getRoom(code: string): Room | undefined;
    get roomCount(): number;
    private getConnectionRoom;
    private sendError;
    private broadcastToRoom;
}
//# sourceMappingURL=LobbyManager.d.ts.map