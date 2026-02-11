import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameRoom } from '../../src/game/GameRoom.js';
import { ServerMessage } from '../../src/shared/messages.js';

function createTestGameRoom(playerCount = 2) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    name: `Player ${i + 1}`,
  }));

  const room = new GameRoom(players);
  const sent: { sessionId: string; message: ServerMessage }[] = [];
  const broadcasted: { sessionIds: string[]; message: ServerMessage }[] = [];
  let gameOverCalled = false;

  const sessionMap = new Map<number, string>();
  players.forEach((p) => sessionMap.set(p.id, `session-${p.id}`));

  room.setCallbacks({
    broadcast: (sessionIds, message) => {
      broadcasted.push({ sessionIds, message });
    },
    sendToPlayer: (sessionId, message) => {
      sent.push({ sessionId, message });
    },
    getConnectedSessionIds: () => [...sessionMap.values()],
    getPlayerSessionId: (playerId) => sessionMap.get(playerId) ?? null,
    getAllSessionIds: () => [...sessionMap.values()],
    onGameOver: () => {
      gameOverCalled = true;
    },
  });

  return { room, sent, broadcasted, sessionMap, isGameOver: () => gameOverCalled };
}

describe('GameRoom', () => {
  it('should create game with correct player names', () => {
    const { room } = createTestGameRoom(2);
    const state = room.getState();

    expect(state.players.length).toBe(2);
    expect(state.players[0].name).toBe('Player 1');
    expect(state.players[1].name).toBe('Player 2');
    expect(state.phase).toBe('select');
  });

  it('should broadcast game started to each player', () => {
    const { room, sent } = createTestGameRoom(2);
    room.broadcastGameStarted();

    expect(sent.length).toBe(2);
    expect(sent[0].message.type).toBe('GAME_STARTED');
    expect(sent[1].message.type).toBe('GAME_STARTED');

    // Each player gets their own filtered state
    const state0 = (sent[0].message as any).state;
    const state1 = (sent[1].message as any).state;
    expect(state0.you.id).toBe(0);
    expect(state1.you.id).toBe(1);
  });

  it('should handle select pair', () => {
    const { room, sent, broadcasted } = createTestGameRoom(2);
    room.broadcastGameStarted();
    sent.length = 0;
    broadcasted.length = 0;

    room.handleSelectPair(0, 'session-0', [3, 5]);

    // Should broadcast PAIR_SELECTED
    const pairSelected = broadcasted.find(
      (b) => b.message.type === 'PAIR_SELECTED'
    );
    expect(pairSelected).toBeDefined();
    expect((pairSelected!.message as any).playerId).toBe(0);

    // Should send state update to acting player
    const stateUpdate = sent.find(
      (s) => s.sessionId === 'session-0' && s.message.type === 'STATE_UPDATE'
    );
    expect(stateUpdate).toBeDefined();
  });

  it('should reject invalid card selection', () => {
    const { room, sent } = createTestGameRoom(2);
    sent.length = 0;

    // Try to select same card twice
    room.handleSelectPair(0, 'session-0', [3, 3]);

    const error = sent.find((s) => s.message.type === 'ERROR');
    expect(error).toBeDefined();
    expect((error!.message as any).code).toBe('INVALID_ACTION');
  });

  it('should reject select pair in wrong phase', () => {
    const { room, sent } = createTestGameRoom(2);
    sent.length = 0;

    // Manually force a different phase to test guard
    (room as any).state = { ...(room as any).state, phase: 'reveal' };

    room.handleSelectPair(0, 'session-0', [3, 5]);

    const error = sent.find((s) => s.message.type === 'ERROR');
    expect(error).toBeDefined();
  });

  it('should reject duplicate selection by same player', () => {
    const { room, sent } = createTestGameRoom(2);
    sent.length = 0;

    room.handleSelectPair(0, 'session-0', [3, 5]);
    sent.length = 0;

    room.handleSelectPair(0, 'session-0', [2, 4]);

    const error = sent.find((s) => s.message.type === 'ERROR');
    expect(error).toBeDefined();
    expect((error!.message as any).message).toContain('Already selected');
  });

  it('should transition through full round lifecycle', () => {
    vi.useFakeTimers();
    const { room, sent, broadcasted } = createTestGameRoom(2);
    room.broadcastGameStarted();
    sent.length = 0;
    broadcasted.length = 0;

    // Select phase
    room.handleSelectPair(0, 'session-0', [3, 5]);
    room.handleSelectPair(1, 'session-1', [2, 7]);

    // Should have transitioned to reveal (ALL_PAIRS_SELECTED + PHASE_CHANGED)
    const allPairs = broadcasted.find((b) => b.message.type === 'ALL_PAIRS_SELECTED');
    expect(allPairs).toBeDefined();

    const phaseChanged = sent.find((s) => s.message.type === 'PHASE_CHANGED');
    expect(phaseChanged).toBeDefined();

    // Fast-forward through timer
    vi.advanceTimersByTime(60_000);

    // Should have transitioned to choose
    const timerExpired = broadcasted.find((b) => b.message.type === 'TIMER_EXPIRED');
    expect(timerExpired).toBeDefined();

    sent.length = 0;
    broadcasted.length = 0;

    // Choose phase
    room.handleChooseCard(0, 'session-0', 3);
    room.handleChooseCard(1, 'session-1', 2);

    // Should have ALL_CARDS_CHOSEN
    const allChosen = broadcasted.find((b) => b.message.type === 'ALL_CARDS_CHOSEN');
    expect(allChosen).toBeDefined();

    // Should have ROUND_RESULT
    const roundResult = sent.find((s) => s.message.type === 'ROUND_RESULT');
    expect(roundResult).toBeDefined();

    // After resolve delay, should transition to next round
    vi.advanceTimersByTime(3_000);

    const nextPhase = sent.find(
      (s) => s.message.type === 'PHASE_CHANGED' && (s.message as any).phase === 'select'
    );
    expect(nextPhase).toBeDefined();

    vi.useRealTimers();
  });
});
