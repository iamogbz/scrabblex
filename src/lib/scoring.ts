
import type { Board, BoardSquare, PlacedTile, PlayedWord, Tile } from "@/types";

const getWordFromTiles = (tiles: (PlacedTile | Tile | null)[]) => {
    return tiles.map(t => t?.letter || '').join('');
}

const calculateWordScore = (wordTiles: (BoardSquare | PlacedTile)[], board: Board) => {
    let wordScore = 0;
    let wordMultiplier = 1;
    let newTilesCount = 0;

    wordTiles.forEach(tile => {
        let letterScore = 0;
        
        const placedTile = 'letter' in tile ? tile : null; // It's a PlacedTile from the current move
        const boardSquare = 'multiplier' in tile ? tile as BoardSquare : board[tile.x][tile.y];
        const tileData = placedTile || boardSquare.tile;

        if (!tileData) return;
        
        letterScore = tileData.points;
        
        if (placedTile) { // This is a newly placed tile for this turn
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
): { score: number; mainWord: string; allWords: PlayedWord[] } => {
  if (placedTiles.length === 0) return { score: 0, mainWord: '', allWords: [] };

  const allPlayedWords: PlayedWord[] = [];
  let totalScore = 0;
  
  // This is a simplification. A real Scrabble game needs to check both directions if tiles are placed in a line.
  // For now, assume horizontal if y changes, vertical if x changes. If only one tile, check both.
  const mainDirection = placedTiles.length > 1 
    ? (placedTiles[0].x === placedTiles[1].x ? 'horizontal' : 'vertical') 
    : 'horizontal'; // Default to horizontal for single tile, secondary words will be found.

  const getWordAt = (x: number, y: number, direction: 'horizontal' | 'vertical'): (BoardSquare | PlacedTile)[] => {
      const line: (BoardSquare | PlacedTile)[] = [];
      let currentX = x;
      let currentY = y;

      // Find start of word by backtracking
      if (direction === 'horizontal') {
          while (currentY > 0 && (board[currentX][currentY-1]?.tile || placedTiles.some(t => t.x === currentX && t.y === currentY -1))) {
              currentY--;
          }
      } else { // vertical
          while (currentX > 0 && (board[currentX-1]?.[currentY]?.tile || placedTiles.some(t => t.x === currentX -1 && t.y === currentY))) {
              currentX--;
          }
      }
      
      // Build word by moving forward
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
    const {score: mainScore, newTilesCount} = calculateWordScore(mainWordTiles, board);
    if(newTilesCount > 0){ // only score words that include new tiles
        totalScore += mainScore;
        allPlayedWords.push({
            word: mainWordString,
            score: mainScore,
            playerId: '', // to be filled in later
            tiles: placedTiles,
        });
        // Bingo bonus for using all 7 tiles
        if (placedTiles.length === 7) {
            totalScore += 50;
        }
    }
  }


  // --- Secondary words (cross-words) ---
  const secondaryDirection = mainDirection === 'horizontal' ? 'vertical' : 'horizontal';
  placedTiles.forEach(tile => {
    const crossWordTiles = getWordAt(tile.x, tile.y, secondaryDirection);
    if (crossWordTiles.length > 1) {
        const crossWordString = getWordFromTiles(crossWordTiles);
        const {score: crossScore, newTilesCount} = calculateWordScore(crossWordTiles, board);

        // only score words that include new tiles (should always be true here)
        if(newTilesCount > 0){ 
            totalScore += crossScore;
            allPlayedWords.push({
                word: crossWordString,
                score: crossScore,
                playerId: '',
                tiles: placedTiles,
            });
        }
    }
  })
  
  const mainWordString = getWordFromTiles(mainWordTiles);
  
  return { score: totalScore, mainWord: mainWordString, allWords: allPlayedWords };
};
