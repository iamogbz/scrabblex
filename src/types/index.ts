export interface Tile {
  id: string;
  letter: string;
  points: number;
  originalLetter?: string;
}

export interface PlacedTile extends Tile {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  rack: Tile[];
  code: string;
  isComputer?: boolean;
}

export type GamePhase = "playing" | "ended";

export type BoardSquare = {
  tile: PlacedTile | null;
  multiplierType: "letter" | "word" | null;
  multiplier: number;
  isCenter: boolean;
  x: number;
  y: number;
};

export type Board = BoardSquare[][];

export interface PlayedWord {
  playerId: string;
  playerName: string;
  word: string;
  tiles: PlacedTile[];
  score: number;
  isPass?: boolean;
  isSwap?: boolean;
  isResign?: boolean;
  timestamp: string;
}

export interface GameState {
  gameId: string;
  players: Player[];
  tileBag: Tile[];
  board: Board;
  history: PlayedWord[];
  gamePhase: GamePhase;
  endStatus?: string;
  createdAt?: string;
  crosswordTitle?: string;
}
