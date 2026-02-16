import { ComponentType } from 'react';
import { ServerMessage } from '../shared/types';

export interface GameComponentProps {
  send: (msg: object) => void;
  onGameMessage: (handler: ((msg: ServerMessage) => void) | null) => void;
  setScreenToGame: () => void;
  isHost: boolean;
  playerId: number;
  onLeaveRoom: () => void;
}

export interface GameDefinition {
  gameType: string;
  displayName: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  GameComponent: ComponentType<GameComponentProps>;
}
