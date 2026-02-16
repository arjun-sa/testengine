import { GameAdapter, GameRoomInstance } from '../types.js';
import { CardGameRoom } from './CardGameRoom.js';
import { CardGameActionSchema, CARD_GAME_ACTION_TYPES } from './messages.js';

export const cardGameAdapter: GameAdapter = {
  gameType: 'card-game',
  minPlayers: 2,
  maxPlayers: 4,

  createGameRoom(players: { id: number; name: string }[]): GameRoomInstance {
    return new CardGameRoom(players);
  },

  validateAction(raw: unknown): { ok: true; message: { type: string; [key: string]: unknown } } | { ok: false; error: string } {
    const result = CardGameActionSchema.safeParse(raw);
    if (result.success) {
      return { ok: true, message: result.data as { type: string; [key: string]: unknown } };
    }
    return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid game action' };
  },

  getActionTypes(): string[] {
    return CARD_GAME_ACTION_TYPES;
  },
};
