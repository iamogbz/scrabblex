import type { Tile, BoardSquare } from "@/types";

const generateTileId = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

const createTiles = (letter: string, points: number, count: number): Tile[] => {
  return Array.from({ length: count }, () => ({
    id: generateTileId(),
    letter,
    points,
  }));
};

export const TILE_BAG: Tile[] = [
  ...createTiles("A", 1, 9),
  ...createTiles("B", 3, 2),
  ...createTiles("C", 3, 2),
  ...createTiles("D", 2, 4),
  ...createTiles("E", 1, 12),
  ...createTiles("F", 4, 2),
  ...createTiles("G", 2, 3),
  ...createTiles("H", 4, 2),
  ...createTiles("I", 1, 9),
  ...createTiles("J", 8, 1),
  ...createTiles("K", 5, 1),
  ...createTiles("L", 1, 4),
  ...createTiles("M", 3, 2),
  ...createTiles("N", 1, 6),
  ...createTiles("O", 1, 8),
  ...createTiles("P", 3, 2),
  ...createTiles("Q", 10, 1),
  ...createTiles("R", 1, 6),
  ...createTiles("S", 1, 4),
  ...createTiles("T", 1, 6),
  ...createTiles("U", 1, 4),
  ...createTiles("V", 4, 2),
  ...createTiles("W", 4, 2),
  ...createTiles("X", 8, 1),
  ...createTiles("Y", 4, 2),
  ...createTiles("Z", 10, 1),
  ...createTiles(" ", 0, 2),
];

const BOARD_SIZE = 15;

const premiumSquares = {
  TW: [[0,0], [0,7], [0,14], [7,0], [7,14], [14,0], [14,7], [14,14]],
  DW: [[1,1], [2,2], [3,3], [4,4], [1,13], [2,12], [3,11], [4,10], [10,4], [11,3], [12,2], [13,1], [10,10], [11,11], [12,12], [13,13]],
  TL: [[1,5], [1,9], [5,1], [5,5], [5,9], [5,13], [9,1], [9,5], [9,9], [9,13], [13,5], [13,9]],
  DL: [[0,3], [0,11], [2,6], [2,8], [3,0], [3,7], [3,14], [6,2], [6,6], [6,8], [6,12], [7,3], [7,11], [8,2], [8,6], [8,8], [8,12], [11,0], [11,7], [11,14], [12,6], [12,8], [14,3], [14,11]],
};

export const createInitialBoard = (): BoardSquare[][] => {
  const board = Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from(
      { length: BOARD_SIZE },
      (_, c): BoardSquare => ({
        tile: null,
        multiplier: 1,
        multiplierType: null,
        isCenter: false,
        x: r,
        y: c,
      })
    )
  );

  const setMultiplier = (
    coords: number[][],
    type: "word" | "letter",
    value: number
  ) => {
    coords.forEach(([r, c]) => {
      board[r][c].multiplierType = type;
      board[r][c].multiplier = value;
    });
  };

  setMultiplier(premiumSquares.TW, "word", 3);
  setMultiplier(premiumSquares.DW, "word", 2);
  setMultiplier(premiumSquares.TL, "letter", 3);
  setMultiplier(premiumSquares.DL, "letter", 2);

  board[7][7].isCenter = true;
  board[7][7].multiplierType = "word";
  board[7][7].multiplier = 2;

  return board;
};
