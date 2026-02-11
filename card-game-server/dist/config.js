function parseOrigins(raw) {
    if (!raw)
        return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
export const config = {
    port: parseInt(process.env.PORT ?? '3001', 10),
    allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    maxRooms: parseInt(process.env.MAX_ROOMS ?? '100', 10),
    maxConnectionsPerIp: parseInt(process.env.MAX_CONNECTIONS_PER_IP ?? '20', 10),
};
//# sourceMappingURL=config.js.map