import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardGameRoom } from '../../src/games/card-game/CardGameRoom.js';

function createTestGameRoom(playerCount = 2) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    name: `Player ${i + 1}`,
  }));

  const room = new CardGameRoom(players);
  const sent: { sessionId: string; message: object }[] = [];
  const broadcasted: { sessionIds: string[]; message: object }[] = [];
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

describe('CardGameRoom', () => {
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
    expect((sent[0].message as any).type).toBe('GAME_STARTED');
    expect((sent[1].message as any).type).toBe('GAME_STARTED');

    // Each player gets their own filtered state
    const state0 = (sent[0].message as any).state;
    const state1 = (sent[1].message as any).state;
    expect(state0.you.id).toBe(0);
    expect(state1.you.id).toBe(1);
  });

  it('should handle select pair via handleAction', () => {
    const { room, sent, broadcasted } = createTestGameRoom(2);
    room.broadcastGameStarted();
    sent.length = 0;
    broadcasted.length = 0;

    room.handleAction(0, 'session-0', { type: 'SELECT_PAIR', cards: [3, 5] });

    // Should broadcast PAIR_SELECTED
    const pairSelected = broadcasted.find(
      (b) => (b.message as any).type === 'PAIR_SELECTED'
    );
    expect(pairSelected).toBeDefined();
    expect((pairSelected!.message as any).playerId).toBe(0);

    // Should send state update to acting player
    const stateUpdate = sent.find(
      (s) => s.sessionId === 'session-0' && (s.message as any).type === 'STATE_UPDATE'
    );
    expect(stateUpdate).toBeDefined();
  });

  it('should reject invalid card selection', () => {
    const { room, sent } = createTestGameRoom(2);
    sent.length = 0;

    // Try to select same card twice
    room.handleAction(0, 'session-0', { type: 'SELECT_PAIR', cards: [3, 3] });

    const error = sent.find((s) => (s.message as any).type === 'ERROR');
    expect(error).toBeDefined();
    expect((error!.message as any).code).toBe('INVALID_ACTION');
  });

  it('should reject select pair in wrong phase', () => {
    const { room, sent } = createTestGameRoom(2);
    sent.length = 0;

    // Manually force a different phase to test guard
    (room as any).state = { ...(room as any).state, phase: 'reveal' };

    room.handleAction(0, 'session-0', { type: 'SELECT_PAIR', cards: [3, 5] });

    const error = sent.find((s) => (s.message as any).type === 'ERROR');
    expect(error).toBeDefined();
  });

  it('should reject duplicate selection by same player', () => {
    const { room, sent } = createTestGameRoom(2);
    sent.length = 0;

    room.handleAction(0, 'session-0', { type: 'SELECT_PAIR', cards: [3, 5] });
    sent.length = 0;

    room.handleAction(0, 'session-0', { type: 'SELECT_PAIR', cards: [2, 4] });

    const error = sent.find((s) => (s.message as any).type === 'ERROR');
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
    room.handleAction(0, 'session-0', { type: 'SELECT_PAIR', cards: [3, 5] });
    room.handleAction(1, 'session-1', { type: 'SELECT_PAIR', cards: [2, 7] });

    // Should have transitioned to reveal (ALL_PAIRS_SELECTED + PHASE_CHANGED)
    const allPairs = broadcasted.find((b) => (b.message as any).type === 'ALL_PAIRS_SELECTED');
    expect(allPairs).toBeDefined();

    const phaseChanged = sent.find((s) => (s.message as any).type === 'PHASE_CHANGED');
    expect(phaseChanged).toBeDefined();

    // Fast-forward through timer
    vi.advanceTimersByTime(60_000);

    // Should have transitioned to choose
    const timerExpired = broadcasted.find((b) => (b.message as any).type === 'TIMER_EXPIRED');
    expect(timerExpired).toBeDefined();

    sent.length = 0;
    broadcasted.length = 0;

    // Choose phase
    room.handleAction(0, 'session-0', { type: 'CHOOSE_CARD', card: 3 });
    room.handleAction(1, 'session-1', { type: 'CHOOSE_CARD', card: 2 });

    // Should have ALL_CARDS_CHOSEN
    const allChosen = broadcasted.find((b) => (b.message as any).type === 'ALL_CARDS_CHOSEN');
    expect(allChosen).toBeDefined();

    // Should have ROUND_RESULT
    const roundResult = sent.find((s) => (s.message as any).type === 'ROUND_RESULT');
    expect(roundResult).toBeDefined();

    // After resolve delay, should transition to next round
    vi.advanceTimersByTime(3_000);

    const nextPhase = sent.find(
      (s) => (s.message as any).type === 'PHASE_CHANGED' && (s.message as any).phase === 'select'
    );
    expect(nextPhase).toBeDefined();

    vi.useRealTimers();
  });
});
