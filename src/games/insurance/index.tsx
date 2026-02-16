import { useState } from 'react';
import { GameDefinition, GameComponentProps } from '../types';
import { useInsuranceGame } from './useInsuranceGame';
import { InsuranceBoard } from './components/InsuranceBoard';

function RulesScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="ins-rules-screen">
      <div className="ins-rules-card">
        <h2>Insurance Bidding</h2>
        <div className="ins-rules-body">
          <section>
            <h3>Overview</h3>
            <p>
              You are an insurance company competing for contracts.
              Each round, a group of people need health insurance.
              Set your prices, win contracts, and try to earn the most profit over 6 rounds.
            </p>
          </section>
          <section>
            <h3>How It Works</h3>
            <ol>
              <li>
                <strong>Set Prices</strong> &mdash; Each round, you submit a <em>healthy price</em> and
                a <em>sick price</em>. These are what you'd charge to insure a healthy or sick person.
              </li>
              <li>
                <strong>Bids Revealed</strong> &mdash; Everyone's prices are shown.
              </li>
              <li>
                <strong>Cards Drawn</strong> &mdash; A card is drawn for each person from a shared deck.
                Black cards (clubs/spades) = healthy. Red cards (hearts/diamonds) = sick.
              </li>
              <li>
                <strong>Contracts Assigned</strong> &mdash; Each person buys from the
                cheapest bidder whose price is within their budget.
                Ties are broken randomly. Once someone buys your contract, it's used up for that round
                &mdash; you can sell at most one healthy and one sick contract per round.
              </li>
            </ol>
          </section>
          <section>
            <h3>Costs &amp; Profit</h3>
            <p>
              Insuring a healthy person costs you <strong>$40</strong>.
              Insuring a sick person costs you <strong>$70</strong>.
              Your profit on each contract is your price minus the cost.
              Set prices too high and no one buys; too low and you lose money.
            </p>
          </section>
          <section>
            <h3>The Deck</h3>
            <p>
              A standard 52-card deck is shuffled once and drawn <em>without replacement</em> across
              all rounds. As the game progresses, the remaining deck composition shifts &mdash;
              pay attention to how many red and black cards are left.
            </p>
          </section>
        </div>
        <button className="confirm-btn ins-rules-start-btn" onClick={onContinue}>
          Got It
        </button>
      </div>
    </div>
  );
}

function InsuranceGameComponent({ send, onGameMessage, setScreenToGame, isHost, onLeaveRoom }: GameComponentProps) {
  const game = useInsuranceGame(send, onGameMessage, setScreenToGame);
  const [showRules, setShowRules] = useState(true);

  if (!game.gameState) {
    return <div className="game-loading">Waiting for game to start...</div>;
  }

  if (showRules) {
    return <RulesScreen onContinue={() => setShowRules(false)} />;
  }

  return (
    <InsuranceBoard
      gameState={game.gameState}
      gameOverData={game.gameOverData}
      isHost={isHost}
      onSubmitBid={game.submitBid}
      onSkipTimer={game.skipTimer}
      onTogglePause={game.togglePause}
      onLeaveRoom={onLeaveRoom}
    />
  );
}

export const insuranceGameDefinition: GameDefinition = {
  gameType: 'insurance',
  displayName: 'Insurance Bidding',
  description: 'Bid prices to insure people. Draw cards to reveal health. Cheapest bid wins the contract!',
  minPlayers: 2,
  maxPlayers: 8,
  GameComponent: InsuranceGameComponent,
};
