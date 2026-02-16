import { GameAdapter, GameRoomInstance } from '../types.js';
import { InsuranceGameRoom } from './InsuranceGameRoom.js';
import { InsuranceActionSchema, INSURANCE_ACTION_TYPES } from './messages.js';

export const insuranceGameAdapter: GameAdapter = {
  gameType: 'insurance',
  minPlayers: 2,
  maxPlayers: 8,

  createGameRoom(players: { id: number; name: string }[]): GameRoomInstance {
    return new InsuranceGameRoom(players);
  },

  validateAction(raw: unknown): { ok: true; message: { type: string; [key: string]: unknown } } | { ok: false; error: string } {
    const result = InsuranceActionSchema.safeParse(raw);
    if (result.success) {
      return { ok: true, message: result.data as { type: string; [key: string]: unknown } };
    }
    return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid game action' };
  },

  getActionTypes(): string[] {
    return INSURANCE_ACTION_TYPES;
  },
};
