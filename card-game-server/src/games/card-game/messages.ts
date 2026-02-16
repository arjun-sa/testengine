import { z } from 'zod';

export const SelectPairSchema = z.object({
  type: z.literal('SELECT_PAIR'),
  cards: z.tuple([z.number().int().min(1).max(8), z.number().int().min(1).max(8)]),
});

export const ChooseCardSchema = z.object({
  type: z.literal('CHOOSE_CARD'),
  card: z.number().int().min(1).max(8),
});

export const RequestStateSchema = z.object({
  type: z.literal('REQUEST_STATE'),
});

export const SkipTimerSchema = z.object({
  type: z.literal('SKIP_TIMER'),
});

export const CardGameActionSchema = z.discriminatedUnion('type', [
  SelectPairSchema,
  ChooseCardSchema,
  RequestStateSchema,
  SkipTimerSchema,
]);

export const CARD_GAME_ACTION_TYPES = ['SELECT_PAIR', 'CHOOSE_CARD', 'REQUEST_STATE', 'SKIP_TIMER'];
