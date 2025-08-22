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
}

export type GamePhase = "lobby" | "playing" | "ended";

export type BoardSquare = {
  tile: PlacedTile | null;
  multiplierType: "letter" | "word" | null;
  multiplier: number;
  isCenter: boolean;
};

export type Board = BoardSquare[][];

export interface GameState {
  gameId: string;
  players: Player[];
  tileBag: Tile[];
  board: Board;
  currentPlayerIndex: number;
  gamePhase: GamePhase;
}
