import { useState, useEffect, useRef } from 'react';
import { DrawResult, Person } from '../engine/types';
import { ClientPlayer } from '../multiplayer/types';
import { PersonCard } from './PersonCard';

interface DrawAnimationProps {
  draws: DrawResult[];
  people: Person[];
  players: ClientPlayer[];
  paused?: boolean;
}

export function DrawAnimation({ draws, people, players, paused }: DrawAnimationProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRevealedCount(0);
    intervalRef.current = setInterval(() => {
      setRevealedCount((prev) => {
        if (prev >= draws.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [draws]);

  // Pause/resume the animation interval
  useEffect(() => {
    if (paused && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (!paused && revealedCount < draws.length && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setRevealedCount((prev) => {
          if (prev >= draws.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
  }, [paused, revealedCount, draws.length]);

  return (
    <div className="ins-draw-animation">
      <h3>Drawing Cards</h3>
      <div className="person-grid">
        {people.map((person, i) => (
          <PersonCard
            key={person.id}
            person={person}
            draw={i < revealedCount ? draws[i] : undefined}
            players={players}
          />
        ))}
      </div>
    </div>
  );
}
