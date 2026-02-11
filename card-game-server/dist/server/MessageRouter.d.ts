import { Connection, ConnectionManager } from './ConnectionManager.js';
import { LobbyManager } from '../lobby/LobbyManager.js';
export declare class MessageRouter {
    private connectionManager;
    private lobbyManager;
    constructor(connectionManager: ConnectionManager, lobbyManager: LobbyManager);
    handleRawMessage(connection: Connection, raw: string): void;
    private routeMessage;
    private sendError;
}
//# sourceMappingURL=MessageRouter.d.ts.map