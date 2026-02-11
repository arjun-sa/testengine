import { z } from 'zod';
const CreateRoomSchema = z.object({
    type: z.literal('CREATE_ROOM'),
    playerName: z.string().min(1).max(20).trim(),
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
const SelectPairSchema = z.object({
    type: z.literal('SELECT_PAIR'),
    cards: z.tuple([z.number().int().min(1).max(8), z.number().int().min(1).max(8)]),
});
const ChooseCardSchema = z.object({
    type: z.literal('CHOOSE_CARD'),
    card: z.number().int().min(1).max(8),
});
const RequestStateSchema = z.object({
    type: z.literal('REQUEST_STATE'),
});
const PingSchema = z.object({
    type: z.literal('PING'),
});
const ClientMessageSchema = z.discriminatedUnion('type', [
    CreateRoomSchema,
    JoinRoomSchema,
    LeaveRoomSchema,
    SetReadySchema,
    StartGameSchema,
    SelectPairSchema,
    ChooseCardSchema,
    RequestStateSchema,
    PingSchema,
]);
export function validateMessage(raw) {
    const result = ClientMessageSchema.safeParse(raw);
    if (result.success) {
        return { ok: true, message: result.data };
    }
    return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid message' };
}
//# sourceMappingURL=MessageValidator.js.map