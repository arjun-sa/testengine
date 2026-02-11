import { GameState } from '../engine/types.js';
import {
  createGame,
  startReveal,
  startChoose,
  resolveRound,
  startNextRound,
} from '../engine/gameEngine.js';
import { ServerMessage } from '../shared/messages.js';
import { filterStateForPlayer } from './StateFilter.js';
import { TimerManager } from './TimerManager.js';
import {
  handleSelectPairAction,
  handleChooseCardAction,
  autoSelectPair,
  autoChooseCard,
} from './ActionHandler.js';
import { logger } from '../utils/logger.js';

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

const DISCONNECT_AUTO_PLAY_MS = 30_000;
const RESOLVE_DELAY_MS = 3_000;

export class GameRoom {
  private state: GameState;
  private callbacks: GameRoomCallbacks | null = null;
  private timerManager = new TimerManager();
  private disconnectedTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private connectedPlayerIds = new Set<number>();
  private playerInfoMap: Map<number, PlayerInfo>;

  constructor(players: PlayerInfo[]) {
    this.state = createGame(players.length);

    // Override default names with actual player names
    this.state = {
      ...this.state,
      players: this.state.players.map((p, i) => ({
        ...p,
        name: players[i].name,
      })),
    };

    this.playerInfoMap = new Map(players.map((p) => [p.id, p]));
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
  }

  handleSelectPair(playerId: number, sessionId: string, cards: [number, number]): void {
    if (this.state.phase !== 'select') {
      this.sendError(sessionId, 'INVALID_ACTION', 'Not in select phase');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (player?.selectedPair !== null) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Already selected a pair');
      return;
    }

    const result = handleSelectPairAction(this.state, playerId, cards);
    if (!result.changed) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Invalid card selection');
      return;
    }

    this.state = result.newState;

    // Broadcast that a player selected (no card data)
    this.broadcastToAll({ type: 'PAIR_SELECTED', playerId });

    // Send updated state to acting player
    this.sendStateToPlayer(playerId, sessionId);

    // Check if all pairs selected → start reveal
    if (result.allPairsSelected) {
      this.transitionToReveal();
    }
  }

  handleChooseCard(playerId: number, sessionId: string, card: number): void {
    if (this.state.phase !== 'choose') {
      this.sendError(sessionId, 'INVALID_ACTION', 'Not in choose phase');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (player?.chosenCard !== null) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Already chose a card');
      return;
    }

    const result = handleChooseCardAction(this.state, playerId, card);
    if (!result.changed) {
      this.sendError(sessionId, 'INVALID_ACTION', 'Invalid card choice');
      return;
    }

    this.state = result.newState;

    // Broadcast that a player chose (no card data)
    this.broadcastToAll({ type: 'CARD_CHOSEN', playerId });

    // Send updated state to acting player
    this.sendStateToPlayer(playerId, sessionId);

    // Check if all cards chosen → resolve round
    if (result.allCardsChosen) {
      this.transitionToResolve();
    }
  }

  skipTimer(): void {
    if (this.state.phase !== 'reveal') return;
    this.timerManager.stop();
    this.broadcastToAll({ type: 'TIMER_EXPIRED' });
    this.transitionToChoose();
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

    // Set auto-play timer for disconnected player
    const timer = setTimeout(() => {
      this.autoPlayForPlayer(playerId);
    }, DISCONNECT_AUTO_PLAY_MS);
    this.disconnectedTimers.set(playerId, timer);

    logger.info({ playerId }, 'Player disconnected during game');
  }

  handlePlayerReconnect(playerId: number, sessionId: string): void {
    this.connectedPlayerIds.add(playerId);

    // Cancel auto-play timer
    const timer = this.disconnectedTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectedTimers.delete(playerId);
    }

    // Send full state update
    this.sendStateToPlayer(playerId, sessionId);
    logger.info({ playerId }, 'Player reconnected during game');
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

  private transitionToReveal(): void {
    this.state = startReveal(this.state);
    this.broadcastToAll({ type: 'ALL_PAIRS_SELECTED' });
    this.broadcastPhaseChange();

    // Start server-side timer
    this.timerManager.start(
      60,
      (remaining) => {
        this.state = { ...this.state, timer: remaining };
        this.broadcastToAll({ type: 'TIMER_TICK', timer: remaining });
      },
      () => {
        this.broadcastToAll({ type: 'TIMER_EXPIRED' });
        this.transitionToChoose();
      }
    );
  }

  private transitionToChoose(): void {
    this.state = startChoose(this.state);
    this.broadcastPhaseChange();

    // Check for disconnected players who need auto-play
    this.scheduleAutoPlayForDisconnected();
  }

  private transitionToResolve(): void {
    this.broadcastToAll({ type: 'ALL_CARDS_CHOSEN' });

    this.state = resolveRound(this.state);

    const lastResult = this.state.roundHistory[this.state.roundHistory.length - 1];

    // Broadcast round result with each player's filtered view
    if (!this.callbacks) return;

    for (const [playerId] of this.playerInfoMap) {
      const sessionId = this.callbacks.getPlayerSessionId(playerId);
      if (!sessionId) continue;

      const clientState = filterStateForPlayer(this.state, playerId, this.connectedPlayerIds);

      if (this.state.phase === 'gameOver') {
        const finalScores = this.state.players.map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.score,
        }));
        this.callbacks.sendToPlayer(sessionId, {
          type: 'GAME_OVER',
          state: clientState,
          finalScores,
        });
      } else {
        this.callbacks.sendToPlayer(sessionId, {
          type: 'ROUND_RESULT',
          result: lastResult,
          state: clientState,
        });
      }
    }

    if (this.state.phase === 'gameOver') {
      this.callbacks.onGameOver();
      logger.info('Game over');
    } else {
      // Auto-start next round after delay
      setTimeout(() => {
        this.state = startNextRound(this.state);
        this.broadcastPhaseChange();
        // Auto-play for disconnected players in new select phase
        this.scheduleAutoPlayForDisconnected();
      }, RESOLVE_DELAY_MS);
    }
  }

  private autoPlayForPlayer(playerId: number): void {
    if (!this.connectedPlayerIds.has(playerId)) {
      if (this.state.phase === 'select') {
        const player = this.state.players.find((p) => p.id === playerId);
        if (player && player.selectedPair === null) {
          const result = autoSelectPair(this.state, playerId);
          if (result.changed) {
            this.state = result.newState;
            this.broadcastToAll({ type: 'PAIR_SELECTED', playerId });
            if (result.allPairsSelected) {
              this.transitionToReveal();
            }
          }
        }
      } else if (this.state.phase === 'choose') {
        const player = this.state.players.find((p) => p.id === playerId);
        if (player && player.chosenCard === null) {
          const result = autoChooseCard(this.state, playerId);
          if (result.changed) {
            this.state = result.newState;
            this.broadcastToAll({ type: 'CARD_CHOSEN', playerId });
            if (result.allCardsChosen) {
              this.transitionToResolve();
            }
          }
        }
      }
    }
    this.disconnectedTimers.delete(playerId);
  }

  private scheduleAutoPlayForDisconnected(): void {
    for (const [playerId] of this.playerInfoMap) {
      if (!this.connectedPlayerIds.has(playerId)) {
        // Clear existing timer
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

  private broadcastToAll(message: ServerMessage): void {
    if (!this.callbacks) return;
    const sessionIds = this.callbacks.getConnectedSessionIds();
    this.callbacks.broadcast(sessionIds, message);
  }

  private sendError(sessionId: string, code: string, message: string): void {
    if (!this.callbacks) return;
    this.callbacks.sendToPlayer(sessionId, {
      type: 'ERROR',
      code: code as any,
      message,
    });
  }
}
