import { GameState } from '../engine/types.js';
export interface ActionResult {
    newState: GameState;
    changed: boolean;
    allPairsSelected?: boolean;
    allCardsChosen?: boolean;
}
export declare function handleSelectPairAction(state: GameState, playerId: number, cards: [number, number]): ActionResult;
export declare function handleChooseCardAction(state: GameState, playerId: number, card: number): ActionResult;
/**
 * Auto-play for disconnected players: select the two lowest available cards,
 * then choose the lower one.
 */
export declare function autoSelectPair(state: GameState, playerId: number): ActionResult;
export declare function autoChooseCard(state: GameState, playerId: number): ActionResult;
//# sourceMappingURL=ActionHandler.d.ts.map