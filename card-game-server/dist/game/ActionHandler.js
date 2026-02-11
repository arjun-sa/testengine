import { selectPair, allPairsSelected, chooseCard, allCardsChosen, } from '../engine/gameEngine.js';
export function handleSelectPairAction(state, playerId, cards) {
    const newState = selectPair(state, playerId, cards);
    const changed = newState !== state;
    return {
        newState,
        changed,
        allPairsSelected: changed ? allPairsSelected(newState) : false,
    };
}
export function handleChooseCardAction(state, playerId, card) {
    const newState = chooseCard(state, playerId, card);
    const changed = newState !== state;
    return {
        newState,
        changed,
        allCardsChosen: changed ? allCardsChosen(newState) : false,
    };
}
/**
 * Auto-play for disconnected players: select the two lowest available cards,
 * then choose the lower one.
 */
export function autoSelectPair(state, playerId) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player)
        return { newState: state, changed: false };
    const available = player.hand
        .filter((c) => !player.benchedCards.includes(c))
        .sort((a, b) => a - b);
    if (available.length < 2)
        return { newState: state, changed: false };
    return handleSelectPairAction(state, playerId, [available[0], available[1]]);
}
export function autoChooseCard(state, playerId) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !player.selectedPair)
        return { newState: state, changed: false };
    const lowestCard = Math.min(...player.selectedPair);
    return handleChooseCardAction(state, playerId, lowestCard);
}
//# sourceMappingURL=ActionHandler.js.map