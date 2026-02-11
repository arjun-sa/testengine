// Characters chosen to avoid confusable pairs (0/O, 1/I/L)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
export function generateRoomCode(existingCodes) {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
        let code = '';
        for (let j = 0; j < CODE_LENGTH; j++) {
            code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
        }
        if (!existingCodes.has(code)) {
            return code;
        }
    }
    throw new Error('Failed to generate unique room code');
}
//# sourceMappingURL=RoomCodeGenerator.js.map