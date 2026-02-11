import { ClientMessage } from '../shared/messages.js';
export type ValidationResult = {
    ok: true;
    message: ClientMessage;
} | {
    ok: false;
    error: string;
};
export declare function validateMessage(raw: unknown): ValidationResult;
//# sourceMappingURL=MessageValidator.d.ts.map