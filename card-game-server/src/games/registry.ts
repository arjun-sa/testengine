import { GameAdapter } from './types.js';

const adapters = new Map<string, GameAdapter>();

export function registerGame(adapter: GameAdapter): void {
  adapters.set(adapter.gameType, adapter);
}

export function getGameAdapter(gameType: string): GameAdapter | undefined {
  return adapters.get(gameType);
}

export function getAvailableGames(): GameAdapter[] {
  return [...adapters.values()];
}
