
export interface Tile {
  letter: string;
  points: number;
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
}

export type GamePhase = "playing" | "ended";

export type BoardSquare = {
  tile: PlacedTile | null;
  multiplierType: "letter" | "word" | null;
  multiplier: number;
  isCenter: boolean;
};

export type Board = BoardSquare[][];

export interface PlayedWord {
  playerId: string;
  word: string;
  tiles: PlacedTile[];
}

export interface GameState {
  gameId: string;
  players: Player[];
  tileBag: Tile[];
  board: Board;
  history: PlayedWord[];
  gamePhase: GamePhase;
}
