import { GameDefinition } from './types';
import { cardGameDefinition } from './card-game/index';
import { insuranceGameDefinition } from './insurance/index';

const games = new Map<string, GameDefinition>();

// Register all available games
games.set(cardGameDefinition.gameType, cardGameDefinition);
games.set(insuranceGameDefinition.gameType, insuranceGameDefinition);

export function getGameDefinition(gameType: string): GameDefinition | undefined {
  return games.get(gameType);
}

export function getAvailableGames(): GameDefinition[] {
  return [...games.values()];
}
