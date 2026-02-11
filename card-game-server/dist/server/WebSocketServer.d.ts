import { Server as HTTPServer } from 'node:http';
import { ConnectionManager } from './ConnectionManager.js';
import { LobbyManager } from '../lobby/LobbyManager.js';
export declare class GameWebSocketServer {
    private wss;
    private connectionManager;
    private messageRouter;
    private lobbyManager;
    constructor(server: HTTPServer);
    private handleUpgrade;
    private handleConnection;
    getConnectionManager(): ConnectionManager;
    getLobbyManager(): LobbyManager;
}
//# sourceMappingURL=WebSocketServer.d.ts.map