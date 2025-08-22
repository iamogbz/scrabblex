import type { Tile, BoardSquare } from "@/types";

export const TILE_BAG: Tile[] = [
  { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 }, { letter: "A", points: 1 },
  { letter: "B", points: 3 }, { letter: "B", points: 3 },
  { letter: "C", points: 3 }, { letter: "C", points: 3 },
  { letter: "D", points: 2 }, { letter: "D", points: 2 }, { letter: "D", points: 2 }, { letter: "D", points: 2 },
  { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 }, { letter: "E", points: 1 },
  { letter: "F", points: 4 }, { letter: "F", points: 4 },
  { letter: "G", points: 2 }, { letter: "G", points: 2 }, { letter: "G", points: 2 },
  { letter: "H", points: 4 }, { letter: "H", points: 4 },
  { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 }, { letter: "I", points: 1 },
  { letter: "J", points: 8 },
  { letter: "K", points: 5 },
  { letter: "L", points: 1 }, { letter: "L", points: 1 }, { letter: "L", points: 1 }, { letter: "L", points: 1 },
  { letter: "M", points: 3 }, { letter: "M", points: 3 },
  { letter: "N", points: 1 }, { letter: "N", points: 1 }, { letter: "N", points: 1 }, { letter: "N", points: 1 }, { letter: "N", points: 1 }, { letter: "N", points: 1 },
  { letter: "O", points: 1 }, { letter: "O", points: 1 }, { letter: "O", points: 1 }, { letter: "O", points: 1 }, { letter: "O", points: 1 }, { letter: "O", points: 1 }, { letter: "O", points: 1 }, { letter: "O", points: 1 },
  { letter: "P", points: 3 }, { letter: "P", points: 3 },
  { letter: "Q", points: 10 },
  { letter: "R", points: 1 }, { letter: "R", points: 1 }, { letter: "R", points: 1 }, { letter: "R", points: 1 }, { letter: "R", points: 1 }, { letter: "R", points: 1 },
  { letter: "S", points: 1 }, { letter: "S", points: 1 }, { letter: "S", points: 1 }, { letter: "S", points: 1 },
  { letter: "T", points: 1 }, { letter: "T", points: 1 }, { letter: "T", points: 1 }, { letter: "T", points: 1 }, { letter: "T", points: 1 }, { letter: "T", points: 1 },
  { letter: "U", points: 1 }, { letter: "U", points: 1 }, { letter: "U", points: 1 }, { letter: "U", points: 1 },
  { letter: "V", points: 4 }, { letter: "V", points: 4 },
  { letter: "W", points: 4 }, { letter: "W", points: 4 },
  { letter: "X", points: 8 },
  { letter: "Y", points: 4 }, { letter: "Y", points: 4 },
  { letter: "Z", points: 10 },
  // Blanks - represented as empty string for now
  // { letter: " ", points: 0 }, { letter: " ", points: 0 },
];

const BOARD_SIZE = 15;

const premiumSquares = {
  TW: [[0,0], [0,7], [0,14], [7,0], [7,14], [14,0], [14,7], [14,14]],
  DW: [[1,1], [2,2], [3,3], [4,4], [1,13], [2,12], [3,11], [4,10], [10,4], [11,3], [12,2], [13,1], [10,10], [11,11], [12,12], [13,13]],
  TL: [[1,5], [1,9], [5,1], [5,5], [5,9], [5,13], [9,1], [9,5], [9,9], [9,13], [13,5], [13,9]],
  DL: [[0,3], [0,11], [2,6], [2,8], [3,0], [3,7], [3,14], [6,2], [6,6], [6,8], [6,12], [7,3], [7,11], [8,2], [8,6], [8,8], [8,12], [11,0], [11,7], [11,14], [12,6], [12,8], [14,3], [14,11]],
};

export const createInitialBoard = (): BoardSquare[][] => {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): BoardSquare => ({
      tile: null,
      multiplier: 1,
      multiplierType: null,
      isCenter: false
    }))
  );

  const setMultiplier = (coords: number[][], type: 'word' | 'letter', value: number) => {
    coords.forEach(([r, c]) => {
      board[r][c].multiplierType = type;
      board[r][c].multiplier = value;
    });
  };

  setMultiplier(premiumSquares.TW, 'word', 3);
  setMultiplier(premiumSquares.DW, 'word', 2);
  setMultiplier(premiumSquares.TL, 'letter', 3);
  setMultiplier(premiumSquares.DL, 'letter', 2);
  
  board[7][7].isCenter = true;
  board[7][7].multiplierType = 'word';
  board[7][7].multiplier = 2;


  return board;
};
