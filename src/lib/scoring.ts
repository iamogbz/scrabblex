
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

    wordTiles.forEach(boardSquareOrPlacedTile => {
        let letterScore = 0;

        const isPreviousTile = "tile" in boardSquareOrPlacedTile
        const tile = isPreviousTile
            ? boardSquareOrPlacedTile.tile
            : boardSquareOrPlacedTile;
        if (!tile) return;

        if (tile.x === undefined || tile.y === undefined || tile.x < 0 || tile.x >= 15 || tile.y < 0 || tile.y >= 15) return;

        const boardRow = board[tile.x];
        if (!boardRow) return;

        const boardSquare = boardRow[tile.y];
        if (!boardSquare) return;

        letterScore = tile.points;

        if (!isPreviousTile) {
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
): { score: number; words: WordInfo[]; isBingo: boolean } => {
  if (placedTiles.length === 0) return { score: 0, words: [], isBingo: false };

  let totalScore = 0;
  const allWordsInfo: WordInfo[] = [];
  const uniqueWords = new Set<string>();

  // If there's only one tile, we need to check both directions.
  // If there are multiple, we can infer the main direction.
  const directionsToCheck: ('horizontal' | 'vertical')[] = [];
  if (placedTiles.length > 1) {
    if (placedTiles[0].x === placedTiles[1].x) {
        directionsToCheck.push('horizontal');
    } else {
        directionsToCheck.push('vertical');
    }
  } else {
    // For a single tile, it could form a word in either or both directions
    directionsToCheck.push('horizontal', 'vertical');
  }


  const getWordAt = (x: number, y: number, direction: 'horizontal' | 'vertical'): (BoardSquare | PlacedTile)[] => {
      const line: (BoardSquare | PlacedTile)[] = [];
      let currentX = x;
      let currentY = y;

      // Backtrack to the start of the potential word
      if (direction === 'horizontal') {
          while (currentY > 0 && (board[currentX]?.[currentY-1]?.tile || placedTiles.some(t => t.x === currentX && t.y === currentY -1))) {
              currentY--;
          }
      } else {
          while (currentX > 0 && (board[currentX-1]?.[currentY]?.tile || placedTiles.some(t => t.x === currentX -1 && t.y === currentY))) {
              currentX--;
          }
      }

      // Build the word forward from the starting point
      while (currentX < 15 && currentY < 15) {
          const boardSquare = board[currentX]?.[currentY];
          if (!boardSquare) break;

          const newTile = placedTiles.find(t => t.x === currentX && t.y === currentY);

          if (newTile) {
            line.push(newTile);
          } else if (boardSquare.tile) {
            line.push(boardSquare);
          } else {
            break; // Stop if we hit an empty square
          }

          if (direction === 'horizontal') currentY++;
          else currentX++;
      }
      return line;
  }

  // --- Main Word(s) and Secondary words (cross-words) ---
  const mainDirection = directionsToCheck[0];
  const secondaryDirection = mainDirection === 'horizontal' ? 'vertical' : 'horizontal';

  // Check main word
  const mainWordTiles = getWordAt(placedTiles[0].x, placedTiles[0].y, mainDirection);
  if (mainWordTiles.length > 1) {
      const mainWordString = getWordFromTiles(mainWordTiles);
      if (!uniqueWords.has(mainWordString)) {
          allWordsInfo.push({ word: mainWordString, tiles: mainWordTiles, direction: mainDirection });
          uniqueWords.add(mainWordString);
      }
  }

  // Check for secondary (cross) words for each placed tile
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

  // If only one tile was placed, the cross-word might have been the "main" word, so check the other direction too.
  if (placedTiles.length === 1) {
    const otherDirectionTiles = getWordAt(placedTiles[0].x, placedTiles[0].y, secondaryDirection);
     if (otherDirectionTiles.length > 1) {
        const otherWordString = getWordFromTiles(otherDirectionTiles);
        if (!uniqueWords.has(otherWordString)) {
            allWordsInfo.push({ word: otherWordString, tiles: otherDirectionTiles, direction: secondaryDirection });
            uniqueWords.add(otherWordString);
        }
    }
  }


  // --- Calculate total score from all found words ---
  allWordsInfo.forEach(wordInfo => {
      const { score, newTilesCount } = calculateWordScore(wordInfo.tiles, board);
      // Only add to score if the word includes at least one newly placed tile
      if(newTilesCount > 0){
        totalScore += score;
      }
  });

  // Bingo bonus
  const isBingo = placedTiles.length >= 7;
  if (isBingo) {
      totalScore += 50;
  }

  return { score: totalScore, words: allWordsInfo, isBingo };
};
