import { GameState } from './types.js';
export declare function createGame(playerCount: number, totalRounds?: number): GameState;
export declare function selectPair(state: GameState, playerId: number, cards: [number, number]): GameState;
export declare function allPairsSelected(state: GameState): boolean;
export declare function startReveal(state: GameState): GameState;
export declare function tickTimer(state: GameState): GameState;
export declare function startChoose(state: GameState): GameState;
export declare function chooseCard(state: GameState, playerId: number, card: number): GameState;
export declare function allCardsChosen(state: GameState): boolean;
export declare function resolveRound(state: GameState): GameState;
export declare function startNextRound(state: GameState): GameState;
//# sourceMappingURL=gameEngine.d.ts.map