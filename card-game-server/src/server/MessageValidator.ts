import { z } from 'zod';

// Lobby message schemas only
const CreateRoomSchema = z.object({
  type: z.literal('CREATE_ROOM'),
  playerName: z.string().min(1).max(20).trim(),
  gameType: z.string().min(1).max(50).optional(),
});

const JoinRoomSchema = z.object({
  type: z.literal('JOIN_ROOM'),
  roomCode: z.string().length(4).regex(/^[A-Z2-9]+$/),
  playerName: z.string().min(1).max(20).trim(),
});

const LeaveRoomSchema = z.object({
  type: z.literal('LEAVE_ROOM'),
});

const SetReadySchema = z.object({
  type: z.literal('SET_READY'),
  ready: z.boolean(),
});

const StartGameSchema = z.object({
  type: z.literal('START_GAME'),
});

const PingSchema = z.object({
  type: z.literal('PING'),
});

const LobbyMessageSchema = z.discriminatedUnion('type', [
  CreateRoomSchema,
  JoinRoomSchema,
  LeaveRoomSchema,
  SetReadySchema,
  StartGameSchema,
  PingSchema,
]);

const LOBBY_TYPES = new Set(['CREATE_ROOM', 'JOIN_ROOM', 'LEAVE_ROOM', 'SET_READY', 'START_GAME', 'PING']);

// Basic structural check for any message (must have a string type field)
const BaseMessageSchema = z.object({
  type: z.string().min(1).max(50),
}).passthrough();

export type ValidationResult =
  | { ok: true; isLobby: true; message: { type: string; [key: string]: unknown } }
  | { ok: true; isLobby: false; message: { type: string; [key: string]: unknown } }
  | { ok: false; error: string };

export function validateMessage(raw: unknown): ValidationResult {
  // First check basic structure
  const baseResult = BaseMessageSchema.safeParse(raw);
  if (!baseResult.success) {
    return { ok: false, error: baseResult.error.issues[0]?.message ?? 'Invalid message' };
  }

  const messageType = baseResult.data.type;

  // If it's a lobby message, validate with strict schema
  if (LOBBY_TYPES.has(messageType)) {
    const lobbyResult = LobbyMessageSchema.safeParse(raw);
    if (lobbyResult.success) {
      return { ok: true, isLobby: true, message: lobbyResult.data as { type: string; [key: string]: unknown } };
    }
    return { ok: false, error: lobbyResult.error.issues[0]?.message ?? 'Invalid message' };
  }

  // Otherwise it's a game action — pass through with basic validation
  return { ok: true, isLobby: false, message: baseResult.data as { type: string; [key: string]: unknown } };
}
