# Multiplayer Server Architecture — Lowest Unique Card Game

## Context

The single-player card game engine is built and working (React + TypeScript, pure state machine in `src/engine/`). All engine functions are pure `(state, action) → state` with no browser dependencies, making them directly usable server-side. This plan designs the multiplayer server as a **separate repo/project** to be deployed on an external Linux machine. **Architecture plan only — no code yet.**

---

## 1. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Node.js 20 LTS + TypeScript** | Matches client toolchain; engine files import directly |
| WebSocket | **`ws`** library | Zero dependencies, full control over message framing, no unnecessary abstractions for 2-4 player rooms |
| HTTP | **Express** (minimal) | Health check endpoint (`GET /health`), room listing if needed |
| Validation | **`zod`** | Runtime schema validation on all incoming client messages |
| Logging | **`pino`** | Fast structured JSON logging |
| IDs | **`uuid`** | Session tokens (UUID v4) |
| Deployment | **Docker** + **systemd** | Dockerfile (node:20-alpine), systemd unit to run the container with `restart=always` |
| TLS | **nginx** or **Caddy** reverse proxy | Terminates TLS → `wss://`, proxies to `ws://localhost:3001` |

---

## 2. Server Repo Structure

```
card-game-server/
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── scripts/
│   └── sync-engine.sh          # Copies engine files from client repo
├── src/
│   ├── index.ts                 # Entry: HTTP server + WS upgrade
│   ├── config.ts                # Env config (port, cors, limits)
│   │
│   ├── engine/                  # COPIED from client repo (see §3)
│   │   ├── types.ts
│   │   ├── gameEngine.ts
│   │   └── scoring.ts
│   │
│   ├── shared/
│   │   ├── messages.ts          # ClientMessage, ServerMessage union types
│   │   └── clientView.ts        # ClientGameState, ClientPlayer, ClientSelfPlayer
│   │
│   ├── server/
│   │   ├── WebSocketServer.ts   # ws setup, connection handling, upgrade
│   │   ├── ConnectionManager.ts # sessionId → { ws, playerId, roomCode }
│   │   ├── MessageRouter.ts     # Dispatch validated messages to handlers
│   │   └── MessageValidator.ts  # Zod schemas for every ClientMessage
│   │
│   ├── lobby/
│   │   ├── LobbyManager.ts     # Create/join/leave rooms, cleanup
│   │   ├── Room.ts              # Single room: players, ready status, lifecycle
│   │   └── RoomCodeGenerator.ts # 4-char codes (ABCDEFGHJKMNPQRSTUVWXYZ23456789)
│   │
│   ├── game/
│   │   ├── GameRoom.ts          # Wraps engine: validate → apply → filter → broadcast
│   │   ├── StateFilter.ts       # Strip private info per-player
│   │   ├── TimerManager.ts      # Server-side 60s reveal countdown
│   │   └── ActionHandler.ts     # Process game actions (selectPair, chooseCard)
│   │
│   └── utils/
│       ├── logger.ts
│       └── rateLimiter.ts       # Token bucket per connection
│
└── tests/
    ├── game/
    │   ├── gameRoom.test.ts
    │   └── stateFilter.test.ts
    ├── lobby/
    │   └── lobbyManager.test.ts
    └── integration/
        └── fullGameFlow.test.ts # End-to-end WS test of complete game
```

---

## 3. Shared Types Strategy

**Phase 1 (now):** Copy `types.ts`, `gameEngine.ts`, `scoring.ts` into server's `src/engine/`. Add a `scripts/sync-engine.sh` that copies from a sibling directory. Each file gets a header comment: `// SOURCE: card-game-engine/src/engine/<file> — keep in sync`.

**Phase 2 (when stable):** Extract engine into a shared `@card-game/engine` npm package. Both repos depend on it. No git submodules (fragile, confusing).

The `shared/messages.ts` and `shared/clientView.ts` protocol types also need to be copied to the client when the client is updated for multiplayer.

---

## 4. Message Protocol

All messages are JSON with a `type` discriminator.

### Client → Server

```
Lobby:
  CREATE_ROOM    { playerName: string }
  JOIN_ROOM      { roomCode: string, playerName: string }
  LEAVE_ROOM     {}
  SET_READY      { ready: boolean }
  START_GAME     {}                        // host only

Game:
  SELECT_PAIR    { cards: [number, number] }  // playerId inferred from session
  CHOOSE_CARD    { card: number }             // playerId inferred from session
  REQUEST_STATE  {}                           // reconnection: get current view

Heartbeat:
  PING           {}
```

**Key: clients never send a playerId.** The server identifies players by session token, preventing impersonation.

### Server → Client

```
Lobby:
  ROOM_CREATED      { roomCode, playerId }
  ROOM_JOINED       { roomCode, playerId, players: LobbyPlayer[] }
  PLAYER_JOINED     { player: LobbyPlayer }
  PLAYER_LEFT       { playerId }
  PLAYER_READY      { playerId, ready }
  ROOM_CLOSED       { reason }

Game state:
  GAME_STARTED      { state: ClientGameState }
  STATE_UPDATE       { state: ClientGameState }
  PHASE_CHANGED      { phase, state: ClientGameState }

Game events (informational, no private data leaked):
  PAIR_SELECTED      { playerId }           // "Player X selected" (no card values)
  ALL_PAIRS_SELECTED {}
  TIMER_TICK         { timer: number }
  TIMER_EXPIRED      {}
  CARD_CHOSEN        { playerId }           // "Player X chose" (no card values)
  ALL_CARDS_CHOSEN   {}
  ROUND_RESULT       { result: RoundResult, state: ClientGameState }
  GAME_OVER          { state: ClientGameState, finalScores }

Errors:
  ERROR              { code: ErrorCode, message: string }

Heartbeat:
  PONG               {}
```

### Error Codes

```
INVALID_MESSAGE       // Malformed JSON or unknown type
ROOM_NOT_FOUND        // Room code doesn't exist
ROOM_FULL             // 4 players already
ROOM_IN_GAME          // Game already started
NOT_YOUR_TURN         // Action not valid in current phase
INVALID_ACTION        // Card not in hand, etc.
NOT_HOST              // Non-host tried to start game
NOT_ENOUGH_PLAYERS    // Fewer than 2 ready players
ALREADY_IN_ROOM       // Player tried to join while already in a room
RATE_LIMITED          // Too many messages
```

### ClientGameState (filtered view sent to each player)

```typescript
ClientGameState {
  phase, currentRound, totalRounds, timer, roundHistory  // all public

  you: {                         // full info for the receiving player
    id, name, score,
    hand: number[],              // YOUR hand (private)
    selectedPair,                // YOUR selection (private until reveal)
    chosenCard,                  // YOUR choice (private until resolve)
    benchedCards: number[]       // YOUR benched cards (private)
  }

  players: ClientPlayer[] {      // filtered info for all players
    id, name, score,
    hasSelectedPair: boolean,    // boolean flag only
    hasChosenCard: boolean,      // boolean flag only
    selectedPair,                // null until reveal phase, then visible
    chosenCard,                  // null until resolve phase, then visible
    benchedCardCount: number     // count only, not which cards
  }
}
```

### Privacy rules by phase

| Field | Owner | Others (select) | Others (reveal) | Others (choose) | Others (resolve) |
|-------|-------|-----------------|-----------------|-----------------|------------------|
| hand | Always | Never | Never | Never | Never |
| selectedPair | Always | Never | **Visible** | Visible | Visible |
| chosenCard | Always | Never | Never | Never | **Visible** |
| benchedCards | Always | Never | Never | Never | Never |
| score | Always | Always | Always | Always | Always |

### Connection Lifecycle

```
Client                          Server
  |                               |
  |--- WS Connect (/ws?session=<token>) -->
  |<-- PONG (connection ack) -----|
  |                               |
  |--- CREATE_ROOM ------------->|
  |<-- ROOM_CREATED -------------|
  |                               |
  |--- SET_READY {ready:true} -->|
  |<-- PLAYER_READY -------------|  (broadcast to room)
  |                               |
  |--- START_GAME -------------->|  (host only, 2+ ready players)
  |<-- GAME_STARTED -------------|  (each gets filtered state)
  |                               |
  |--- SELECT_PAIR ------------->|
  |<-- STATE_UPDATE -------------|  (your state updated)
  |<-- PAIR_SELECTED ------------|  (broadcast: no card data)
  |                               |
  |   ... all players select ...  |
  |<-- ALL_PAIRS_SELECTED -------|
  |<-- PHASE_CHANGED {reveal} ---|  (state now includes all selectedPairs)
  |<-- TIMER_TICK {59} ----------|
  |   ... 60 seconds ...          |
  |<-- TIMER_EXPIRED ------------|
  |<-- PHASE_CHANGED {choose} ---|
  |                               |
  |--- CHOOSE_CARD ------------->|
  |<-- CARD_CHOSEN --------------|  (broadcast: no card data)
  |   ... all players choose ...  |
  |<-- ALL_CARDS_CHOSEN ---------|
  |<-- ROUND_RESULT -------------|  (includes all chosenCards)
  |                               |
  |   ... 8 rounds ...            |
  |<-- GAME_OVER ----------------|
```

---

## 5. Server Architecture

### 5.1 GameRoom — wrapping the pure engine

The core class. Holds authoritative `GameState`, wraps every engine function:

```
handleSelectPair(playerId, cards):
  1. Guard: phase === 'select', player hasn't already selected
  2. newState = selectPair(state, playerId, cards)
  3. If newState === state → reject (engine returned same ref = validation failed)
  4. state = newState
  5. Broadcast PAIR_SELECTED (no card data) to room
  6. Send STATE_UPDATE to acting player
  7. If allPairsSelected → state = startReveal(state), start timer, broadcast phase change
```

Same pattern for `handleChooseCard`. The engine is never forked or modified — just called and wrapped with auth/broadcast/filtering.

### 5.2 Timer management

Server owns the 60s reveal timer. `TimerManager` uses `setInterval` server-side, broadcasts `TIMER_TICK` every second, calls `startChoose` on expiry. Client displays the server's value — never counts independently.

### 5.3 Concurrency

Node.js single-threaded event loop means no race conditions. Two simultaneous `SELECT_PAIR` messages are processed sequentially. All state mutations are synchronous (no `await` between read and write of `this.state`).

### 5.4 Disconnect/reconnect

- Session token (UUID v4) issued on first connect, stored in client `localStorage`
- Reconnect via `ws://server:3001/ws?session=<token>`
- On disconnect: 90-second grace period, game continues for others
- Disconnected player auto-plays after 30s timeout (lowest available cards)
- On reconnect: associate new WS with existing session, send full `STATE_UPDATE`
- If <2 connected players remain after grace period: end game early

### 5.5 Lobby

- `LobbyManager` maintains `Map<roomCode, Room>`
- Room codes: 4-char from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no confusable chars), 810K possibilities
- Room lifecycle: created on `CREATE_ROOM`, destroyed 5min after last disconnect or 30min after game ends, hard cap 2 hours
- Host (room creator) is the only one who can send `START_GAME`
- Requires 2+ players, all marked ready

---

## 6. Security

- **Input validation**: Every message validated with Zod before processing (types, ranges, card values 1-8, room codes 4-char alphanumeric, names 1-20 chars)
- **Server authority**: Clients never send playerId — inferred from session. All state transitions server-side
- **Rate limiting**: Token bucket per connection (20 burst, 5/sec refill). 3 violations in 60s → disconnect
- **Limits**: Max payload 1KB, max 20 WS connections per IP, max 100 active rooms
- **TLS**: `wss://` via reverse proxy in production. Session tokens never sent over plaintext
- **Origin checking**: Validate `Origin` header on WS upgrade against allowed client URLs

---

## 7. Client Changes Needed (high-level, for future work)

1. **Replace `useGameEngine` hook** with `useMultiplayerGame` — opens WS, sends/receives messages, updates React state from `ClientGameState`
2. **Replace `GameSetup`** with lobby screen — create room, join room, ready toggle, waiting room UI
3. **Refactor `GameBoard`** — remove hot-seat pass screen, show your hand always, show "Player X has selected" status indicators for others
4. **Add connection status UI** — connected/reconnecting/disconnected indicator
5. **Remove direct engine import** — client becomes a pure display layer, no local game logic

---

## 8. Verification Plan

Once implemented, verify with:

1. **Unit tests**: `StateFilter` correctly hides/reveals data per phase, `GameRoom` rejects invalid actions
2. **Integration test**: Script that opens 2-4 WS connections and plays a full 8-round game programmatically
3. **Manual test with wscat**: `wscat -c ws://localhost:3001/ws` — send JSON messages, verify responses
4. **Disconnect test**: Kill a client mid-game, verify grace period and auto-play, reconnect and verify state restoration
5. **Security test**: Send malformed messages, wrong playerId attempts, rapid-fire messages — verify all rejected cleanly
