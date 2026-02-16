import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, Server } from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import { GameWebSocketServer } from '../../src/server/WebSocketServer.js';
import { registerGame } from '../../src/games/registry.js';
import { cardGameAdapter } from '../../src/games/card-game/adapter.js';

// Override config for tests
vi.stubEnv('PORT', '0');
vi.stubEnv('ALLOWED_ORIGINS', '');

// Register the card game adapter for tests
registerGame(cardGameAdapter);

let server: Server;
let port: number;

function connectClient(sessionId?: string): Promise<{ ws: WebSocket; messages: object[]; waitFor: (type: string, timeout?: number) => Promise<object> }> {
  return new Promise((resolve, reject) => {
    const url = sessionId
      ? `ws://localhost:${port}/ws?session=${sessionId}`
      : `ws://localhost:${port}/ws`;

    const ws = new WebSocket(url);
    const messages: object[] = [];

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitFor: (type: string, timeout = 5000): Promise<object> => {
          return new Promise((res, rej) => {
            // Check if already received
            const existing = messages.find((m: any) => m.type === type);
            if (existing) {
              res(existing);
              return;
            }

            const timer = setTimeout(() => {
              rej(new Error(`Timeout waiting for ${type}. Received: ${messages.map((m: any) => m.type).join(', ')}`));
            }, timeout);

            const listener = (data: any) => {
              const msg = JSON.parse(data.toString());
              if (msg.type === type) {
                clearTimeout(timer);
                ws.off('message', listener);
                res(msg);
              }
            };
            ws.on('message', listener);
          });
        },
      });
    });

    ws.on('error', reject);
  });
}

function send(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('Full Game Flow (Integration)', () => {
  beforeAll(async () => {
    const app = express();
    server = createServer(app);
    new GameWebSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it('should handle ping/pong', async () => {
    const client = await connectClient();

    // Wait for session established
    await client.waitFor('SESSION_ESTABLISHED');
    client.messages.length = 0;

    send(client.ws, { type: 'PING' });
    const pong = await client.waitFor('PONG');
    expect((pong as any).type).toBe('PONG');

    client.ws.close();
  });

  it('should reject invalid messages', async () => {
    const client = await connectClient();
    await client.waitFor('SESSION_ESTABLISHED');
    client.messages.length = 0;

    send(client.ws, { type: 'INVALID_TYPE' });

    // Game action with unknown type goes to handleGameAction which requires a room
    const error = await client.waitFor('ERROR');
    expect((error as any).type).toBe('ERROR');

    client.ws.close();
  });

  it('should create and join a room', async () => {
    const host = await connectClient();
    const joiner = await connectClient();

    await host.waitFor('SESSION_ESTABLISHED');
    await joiner.waitFor('SESSION_ESTABLISHED');

    // Host creates room
    send(host.ws, { type: 'CREATE_ROOM', playerName: 'Alice' });
    const created = await host.waitFor('ROOM_CREATED');
    expect((created as any).roomCode).toHaveLength(4);
    expect((created as any).gameType).toBe('card-game');
    const roomCode = (created as any).roomCode;

    // Joiner joins
    send(joiner.ws, { type: 'JOIN_ROOM', roomCode, playerName: 'Bob' });
    const joined = await joiner.waitFor('ROOM_JOINED');
    expect((joined as any).players.length).toBe(2);
    expect((joined as any).gameType).toBe('card-game');

    // Host should be notified
    const playerJoined = await host.waitFor('PLAYER_JOINED');
    expect((playerJoined as any).player.name).toBe('Bob');

    host.ws.close();
    joiner.ws.close();
  });

  it('should play through a complete round', async () => {
    const host = await connectClient();
    const joiner = await connectClient();

    await host.waitFor('SESSION_ESTABLISHED');
    await joiner.waitFor('SESSION_ESTABLISHED');

    // Create and join room
    send(host.ws, { type: 'CREATE_ROOM', playerName: 'Alice' });
    const created = await host.waitFor('ROOM_CREATED');
    const roomCode = (created as any).roomCode;

    send(joiner.ws, { type: 'JOIN_ROOM', roomCode, playerName: 'Bob' });
    await joiner.waitFor('ROOM_JOINED');

    // Both ready up
    send(host.ws, { type: 'SET_READY', ready: true });
    send(joiner.ws, { type: 'SET_READY', ready: true });
    await wait(100);

    // Clear messages
    host.messages.length = 0;
    joiner.messages.length = 0;

    // Host starts game
    send(host.ws, { type: 'START_GAME' });
    const hostStarted = await host.waitFor('GAME_STARTED');
    const joinerStarted = await joiner.waitFor('GAME_STARTED');
    expect((hostStarted as any).state.phase).toBe('select');
    expect((joinerStarted as any).state.phase).toBe('select');

    // Both select pairs
    host.messages.length = 0;
    joiner.messages.length = 0;

    send(host.ws, { type: 'SELECT_PAIR', cards: [3, 5] });
    await wait(50);
    send(joiner.ws, { type: 'SELECT_PAIR', cards: [2, 7] });

    // Wait for phase change to reveal
    const hostPhase = await host.waitFor('PHASE_CHANGED');
    expect((hostPhase as any).phase).toBe('reveal');

    // Verify selected pairs are visible in reveal phase
    const hostState = (hostPhase as any).state;
    const otherPlayer = hostState.players.find((p: any) => p.id !== hostState.you.id);
    expect(otherPlayer.selectedPair).not.toBeNull();

    host.ws.close();
    joiner.ws.close();
  });
});
