import { GameState } from './engine/types.js';
import {
  createGame,
  submitBid,
  allBidsSubmitted,
  startReveal,
  drawAndAssign,
  startResults,
  startNextRound,
} from './engine/gameEngine.js';
import { GameRoomInstance, GameRoomCallbacks } from '../types.js';
import { filterStateForPlayer } from './StateFilter.js';
import { TimerManager } from './TimerManager.js';
import { logger } from '../../utils/logger.js';

interface PlayerInfo {
  id: number;
  name: string;
}

const HEALTHY_COST = 40;
const SICK_COST = 70;
const DISCONNECT_AUTO_PLAY_MS = 30_000;
const BIDDING_TIMER_S = 30;
const REVEAL_TIMER_S = 8;
const RESULTS_TIMER_S = 6;

export class InsuranceGameRoom implements GameRoomInstance {
  private state: GameState;
  private callbacks: GameRoomCallbacks | null = null;
  private timerManager = new TimerManager();
  private disconnectedTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private connectedPlayerIds = new Set<number>();
  private playerInfoMap: Map<number, PlayerInfo>;
  private hostPlayerId: number;

  constructor(players: PlayerInfo[]) {
    this.state = createGame(players.length);

    this.state = {
      ...this.state,
      players: this.state.players.map((p, i) => ({
        ...p,
        name: players[i].name,
      })),
    };

    this.playerInfoMap = new Map(players.map((p) => [p.id, p]));
    this.hostPlayerId = players[0].id;
    for (const p of players) {
      this.connectedPlayerIds.add(p.id);
    }
  }

  setCallbacks(callbacks: GameRoomCallbacks): void {
    this.callbacks = callbacks;
  }

  broadcastGameStarted(): void {
    if (!this.callbacks) return;

    for (const [playerId] of this.playerInfoMap) {
      const sessionId = this.callbacks.getPlayerSessionId(playerId);
      if (!sessionId) continue;

      const clientState = filterStateForPlayer(this.state, playerId, this.connectedPlayerIds);
      this.callbacks.sendToPlayer(sessionId, {
        type: 'GAME_STARTED',
        state: clientState,
      });
    }

    this.startBiddingTimer();
  }

  handleAction(playerId: number, sessionId: string, message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'SUBMIT_BID':
        this.handleSubmitBid(playerId, sessionId, message.healthyPrice as number, message.sickPrice as number);
        break;
      case 'REQUEST_STATE':
        this.sendStateToPlayer(playerId, sessionId);
        break;
      case 'SKIP_TIMER':
        this.handleSkipTimer(playerId, sessionId);
        break;
      case 'TOGGLE_PAUSE':
        this.handleTogglePause(playerId, sessionId);
        break;
    }
  }

  private handleSubmitBid(playerId: number, sessionId: string, healthyPrice: number, sickPrice: number): void {
    if (this.state.paused) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Game is paused');
      return;
    }

    if (this.state.phase !== 'bidding') {
      this.sendError(sessionId, 'INVALID_ACTION', 'Not in bidding phase');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (player?.healthyBid !== null) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Already submitted a bid');
      return;
    }

    this.state = submitBid(this.state, playerId, healthyPrice, sickPrice);

    this.broadcastToAll({ type: 'BID_SUBMITTED', playerId });
    this.sendStateToPlayer(playerId, sessionId);

    if (allBidsSubmitted(this.state)) {
      this.transitionToReveal();
    }
  }

  private handleSkipTimer(playerId: number, sessionId: string): void {
    if (playerId !== this.hostPlayerId) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Only the host can skip the timer');
      return;
    }
    if (this.state.phase === 'reveal' || this.state.phase === 'results') {
      this.timerManager.stop();
      this.broadcastToAll({ type: 'TIMER_EXPIRED' });
      if (this.state.phase === 'reveal') {
        this.transitionToDrawing();
      } else {
        this.handleResultsExpired();
      }
    }
  }

  private handleTogglePause(playerId: number, sessionId: string): void {
    if (playerId !== this.hostPlayerId) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Only the host can pause the game');
      return;
    }

    if (this.state.phase === 'gameOver') {
      this.sendError(sessionId, 'INVALID_ACTION', 'Cannot pause after game over');
      return;
    }

    if (this.state.paused) {
      // Unpause
      this.state = { ...this.state, paused: false };
      this.timerManager.resume();
      this.broadcastToAll({ type: 'GAME_UNPAUSED' });
      this.broadcastPhaseChange();
      logger.info('Game unpaused');
    } else {
      // Pause
      this.state = { ...this.state, paused: true };
      this.timerManager.pause();
      this.broadcastToAll({ type: 'GAME_PAUSED' });
      this.broadcastPhaseChange();
      logger.info('Game paused');
    }
  }

  sendStateToPlayer(playerId: number, sessionId: string): void {
    if (!this.callbacks) return;
    const clientState = filterStateForPlayer(this.state, playerId, this.connectedPlayerIds);
    this.callbacks.sendToPlayer(sessionId, {
      type: 'STATE_UPDATE',
      state: clientState,
    });
  }

  handlePlayerDisconnect(playerId: number): void {
    this.connectedPlayerIds.delete(playerId);

    const timer = setTimeout(() => {
      this.autoPlayForPlayer(playerId);
    }, DISCONNECT_AUTO_PLAY_MS);
    this.disconnectedTimers.set(playerId, timer);

    logger.info({ playerId }, 'Player disconnected during insurance game');
  }

  handlePlayerReconnect(playerId: number, sessionId: string): void {
    this.connectedPlayerIds.add(playerId);

    const timer = this.disconnectedTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectedTimers.delete(playerId);
    }

    this.sendStateToPlayer(playerId, sessionId);
    logger.info({ playerId }, 'Player reconnected during insurance game');
  }

  cleanup(): void {
    this.timerManager.stop();
    for (const timer of this.disconnectedTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectedTimers.clear();
  }

  getState(): GameState {
    return this.state;
  }

  private startBiddingTimer(): void {
    this.timerManager.start(
      BIDDING_TIMER_S,
      (remaining) => {
        this.state = { ...this.state, timer: remaining };
        this.broadcastToAll({ type: 'TIMER_TICK', timer: remaining });
      },
      () => {
        this.autoBidForMissing();
        this.broadcastToAll({ type: 'TIMER_EXPIRED' });
        if (allBidsSubmitted(this.state)) {
          this.transitionToReveal();
        }
      },
    );
  }

  private autoBidForMissing(): void {
    for (const p of this.state.players) {
      if (p.healthyBid === null) {
        this.state = submitBid(this.state, p.id, HEALTHY_COST, SICK_COST);
        this.broadcastToAll({ type: 'BID_SUBMITTED', playerId: p.id });
      }
    }
  }

  private transitionToReveal(): void {
    this.timerManager.stop();
    this.state = startReveal(this.state);
    this.broadcastToAll({ type: 'ALL_BIDS_SUBMITTED' });
    this.broadcastPhaseChange();

    this.timerManager.start(
      REVEAL_TIMER_S,
      (remaining) => {
        this.state = { ...this.state, timer: remaining };
        this.broadcastToAll({ type: 'TIMER_TICK', timer: remaining });
      },
      () => {
        this.broadcastToAll({ type: 'TIMER_EXPIRED' });
        this.transitionToDrawing();
      },
    );
  }

  private transitionToDrawing(): void {
    this.timerManager.stop();
    this.state = drawAndAssign(this.state);
    this.broadcastPhaseChange();

    const drawTimerS = this.state.players.length * 3;
    this.timerManager.start(
      drawTimerS,
      (remaining) => {
        this.state = { ...this.state, timer: remaining };
        this.broadcastToAll({ type: 'TIMER_TICK', timer: remaining });
      },
      () => {
        this.broadcastToAll({ type: 'TIMER_EXPIRED' });
        this.transitionToResults();
      },
    );
  }

  private transitionToResults(): void {
    this.timerManager.stop();
    this.state = startResults(this.state);

    if (this.state.phase === 'gameOver') {
      this.broadcastGameOver();
      return;
    }

    this.broadcastPhaseChange();

    this.timerManager.start(
      RESULTS_TIMER_S,
      (remaining) => {
        this.state = { ...this.state, timer: remaining };
        this.broadcastToAll({ type: 'TIMER_TICK', timer: remaining });
      },
      () => {
        this.broadcastToAll({ type: 'TIMER_EXPIRED' });
        this.handleResultsExpired();
      },
    );
  }

  private handleResultsExpired(): void {
    this.timerManager.stop();
    this.state = startNextRound(this.state);
    this.broadcastPhaseChange();
    this.startBiddingTimer();
    this.scheduleAutoPlayForDisconnected();
  }

  private broadcastGameOver(): void {
    if (!this.callbacks) return;

    const finalScores = this.state.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      money: p.money,
    }));

    for (const [playerId] of this.playerInfoMap) {
      const sessionId = this.callbacks.getPlayerSessionId(playerId);
      if (!sessionId) continue;

      const clientState = filterStateForPlayer(this.state, playerId, this.connectedPlayerIds);
      this.callbacks.sendToPlayer(sessionId, {
        type: 'GAME_OVER',
        state: clientState,
        finalScores,
      });
    }

    this.callbacks.onGameOver();
    logger.info('Insurance game over');
  }

  private autoPlayForPlayer(playerId: number): void {
    if (!this.connectedPlayerIds.has(playerId)) {
      if (this.state.phase === 'bidding') {
        const player = this.state.players.find((p) => p.id === playerId);
        if (player && player.healthyBid === null) {
          this.state = submitBid(this.state, playerId, HEALTHY_COST, SICK_COST);
          this.broadcastToAll({ type: 'BID_SUBMITTED', playerId });
          if (allBidsSubmitted(this.state)) {
            this.transitionToReveal();
          }
        }
      }
    }
    this.disconnectedTimers.delete(playerId);
  }

  private scheduleAutoPlayForDisconnected(): void {
    for (const [playerId] of this.playerInfoMap) {
      if (!this.connectedPlayerIds.has(playerId)) {
        const existing = this.disconnectedTimers.get(playerId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          this.autoPlayForPlayer(playerId);
        }, DISCONNECT_AUTO_PLAY_MS);
        this.disconnectedTimers.set(playerId, timer);
      }
    }
  }

  private broadcastPhaseChange(): void {
    if (!this.callbacks) return;

    for (const [playerId] of this.playerInfoMap) {
      const sessionId = this.callbacks.getPlayerSessionId(playerId);
      if (!sessionId) continue;

      const clientState = filterStateForPlayer(this.state, playerId, this.connectedPlayerIds);
      this.callbacks.sendToPlayer(sessionId, {
        type: 'PHASE_CHANGED',
        phase: this.state.phase,
        state: clientState,
      });
    }
  }

  private broadcastToAll(message: object): void {
    if (!this.callbacks) return;
    const sessionIds = this.callbacks.getConnectedSessionIds();
    this.callbacks.broadcast(sessionIds, message);
  }

  private sendError(sessionId: string, code: string, message: string): void {
    if (!this.callbacks) return;
    this.callbacks.sendToPlayer(sessionId, {
      type: 'ERROR',
      code,
      message,
    });
  }
}
