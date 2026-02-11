import { GamePhase } from '../engine/types';

interface PhaseDisplayProps {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  timer: number;
  onSkipTimer?: () => void;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  setup: 'Setup',
  select: 'Select 2 Cards',
  reveal: 'Reveal',
  choose: 'Choose 1 Card',
  resolve: 'Round Results',
  gameOver: 'Game Over',
};

export function PhaseDisplay({ phase, currentRound, totalRounds, timer, onSkipTimer }: PhaseDisplayProps) {
  return (
    <div className="phase-display">
      <div className="phase-info">
        <span className="round-label">Round {currentRound} / {totalRounds}</span>
        <span className="phase-label">{PHASE_LABELS[phase]}</span>
      </div>
      {phase === 'reveal' && (
        <div className="timer-section">
          <span className="timer">{timer}s</span>
          <button className="skip-btn" onClick={onSkipTimer}>Skip Timer</button>
        </div>
      )}
    </div>
  );
}
