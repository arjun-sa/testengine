import { z } from 'zod';

export const SubmitBidSchema = z.object({
  type: z.literal('SUBMIT_BID'),
  healthyPrice: z.number().int().min(1).max(999),
  sickPrice: z.number().int().min(1).max(999),
});

export const RequestStateSchema = z.object({
  type: z.literal('REQUEST_STATE'),
});

export const SkipTimerSchema = z.object({
  type: z.literal('SKIP_TIMER'),
});

export const TogglePauseSchema = z.object({
  type: z.literal('TOGGLE_PAUSE'),
});

export const InsuranceActionSchema = z.discriminatedUnion('type', [
  SubmitBidSchema,
  RequestStateSchema,
  SkipTimerSchema,
  TogglePauseSchema,
]);

export const INSURANCE_ACTION_TYPES = ['SUBMIT_BID', 'REQUEST_STATE', 'SKIP_TIMER', 'TOGGLE_PAUSE'];
