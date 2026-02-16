interface CardProps {
  value: number;
  faceUp?: boolean;
  selected?: boolean;
  benched?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Card({ value, faceUp = true, selected = false, benched = false, disabled = false, onClick }: CardProps) {
  const className = [
    'card',
    faceUp ? 'card-face-up' : 'card-face-down',
    selected ? 'card-selected' : '',
    benched ? 'card-benched' : '',
    disabled ? 'card-disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled || benched}
    >
      {faceUp ? value : '?'}
    </button>
  );
}
