
import type { Board, BoardSquare, PlacedTile } from "@/types";

type WordInfo = {
    word: string;
    tiles: (BoardSquare | PlacedTile)[];
    direction: 'horizontal' | 'vertical';
}

const getWordFromTiles = (tiles: (BoardSquare | PlacedTile)[]) => {
    return tiles.map(t => 'letter' in t ? t.letter : t.tile?.letter || '').join('');
}

const calculateWordScore = (wordTiles: (BoardSquare | PlacedTile)[], board: Board) => {
    let wordScore = 0;
    let wordMultiplier = 1;
    let newTilesCount = 0;

    wordTiles.forEach(tile => {
        let letterScore = 0;
        
        const placedTile = 'letter' in tile && 'points' in tile ? tile : null;
        const boardSquare = board[tile.x][tile.y];
        const tileData = placedTile || boardSquare.tile;

        if (!tileData) return;
        
        letterScore = tileData.points;
        
        if (placedTile) {
            newTilesCount++;
            if (boardSquare.multiplierType === 'letter') {
                letterScore *= boardSquare.multiplier;
            }
            if (boardSquare.multiplierType === 'word') {
                wordMultiplier *= boardSquare.multiplier;
            }
        }
        wordScore += letterScore;
    });

    return { score: wordScore * wordMultiplier, newTilesCount };
}


export const calculateMoveScore = (
  placedTiles: PlacedTile[],
  board: Board
): { score: number; words: WordInfo[]; } => {
  if (placedTiles.length === 0) return { score: 0, words: [] };

  let totalScore = 0;
  const allWordsInfo: WordInfo[] = [];
  const uniqueWords = new Set<string>();
  
  const mainDirection = placedTiles.length > 1 
    ? (placedTiles[0].x === placedTiles[1].x ? 'horizontal' : 'vertical') 
    : 'horizontal';

  const getWordAt = (x: number, y: number, direction: 'horizontal' | 'vertical'): (BoardSquare | PlacedTile)[] => {
      const line: (BoardSquare | PlacedTile)[] = [];
      let currentX = x;
      let currentY = y;

      if (direction === 'horizontal') {
          while (currentY > 0 && (board[currentX][currentY-1]?.tile || placedTiles.some(t => t.x === currentX && t.y === currentY -1))) {
              currentY--;
          }
      } else {
          while (currentX > 0 && (board[currentX-1]?.[currentY]?.tile || placedTiles.some(t => t.x === currentX -1 && t.y === currentY))) {
              currentX--;
          }
      }
      
      while (currentX < 15 && currentY < 15) {
          const boardSquare = board[currentX]?.[currentY];
          if (!boardSquare) break;

          const newTile = placedTiles.find(t => t.x === currentX && t.y === currentY);
          
          if (newTile) {
            line.push(newTile);
          } else if (boardSquare.tile) {
            line.push(boardSquare);
          } else {
            break;
          }

          if (direction === 'horizontal') currentY++;
          else currentX++;
      }
      return line;
  }

  // --- Main Word ---
  const mainWordTiles = getWordAt(placedTiles[0].x, placedTiles[0].y, mainDirection);
  if (mainWordTiles.length > 1) {
    const mainWordString = getWordFromTiles(mainWordTiles);
    if (!uniqueWords.has(mainWordString)) {
        allWordsInfo.push({ word: mainWordString, tiles: mainWordTiles, direction: mainDirection });
        uniqueWords.add(mainWordString);
    }
  }


  // --- Secondary words (cross-words) ---
  const secondaryDirection = mainDirection === 'horizontal' ? 'vertical' : 'horizontal';
  placedTiles.forEach(tile => {
    const crossWordTiles = getWordAt(tile.x, tile.y, secondaryDirection);
    if (crossWordTiles.length > 1) {
        const crossWordString = getWordFromTiles(crossWordTiles);
        if (!uniqueWords.has(crossWordString)) {
            allWordsInfo.push({ word: crossWordString, tiles: crossWordTiles, direction: secondaryDirection });
            uniqueWords.add(crossWordString);
        }
    }
  });

  // --- Calculate total score from all found words ---
  allWordsInfo.forEach(wordInfo => {
      const { score, newTilesCount } = calculateWordScore(wordInfo.tiles, board);
      if(newTilesCount > 0){
        totalScore += score;
      }
  });
  
  // Bingo bonus
  if (placedTiles.length === 7) {
      totalScore += 50;
  }
  
  return { score: totalScore, words: allWordsInfo };
};
