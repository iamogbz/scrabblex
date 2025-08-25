
"use client";

import type { GameState, PlacedTile } from "@/types";
import { useMemo } from "react";
import CrosswordTile from "./crossword-tile";

interface CrosswordBoardProps {
  gameState: GameState;
}

export function CrosswordBoard({ gameState }: CrosswordBoardProps) {
  const playedTilesCoords = useMemo(() => {
    const coords = new Set<string>();
    gameState.history.forEach((move) => {
      if (move.tiles) {
        move.tiles.forEach((tile: PlacedTile) => {
          coords.add(`${tile.x},${tile.y}`);
        });
      }
    });
    return coords;
  }, [gameState.history]);


  const getTileFor = (x: number, y: number) => {
    // Find the final tile placed at this position from the history
    for(let i = gameState.history.length - 1; i >= 0; i--) {
        const move = gameState.history[i];
        if (move.tiles) {
            const tile = move.tiles.find(t => t.x === x && t.y === y);
            if (tile) return tile;
        }
    }
    // Check the initial board state in case something was missed (shouldn't happen with full history)
    const boardTile = gameState.board[x][y].tile;
    if(boardTile) return boardTile;
    
    return null;
  }

  return (
    <div className="aspect-square w-full max-w-[70vh] min-w-[248px] mx-auto bg-background rounded-lg shadow-lg p-2 md:p-4 border">
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 md:gap-1 h-full w-full">
        {Array.from({ length: 15 * 15 }).map((_, index) => {
          const x = Math.floor(index / 15);
          const y = index % 15;
          const coordString = `${x},${y}`;

          if (playedTilesCoords.has(coordString)) {
            const tile = getTileFor(x, y);
            return <CrosswordTile key={index} tile={tile} />;
          } else {
            return (
              <div
                key={index}
                className="aspect-square bg-gray-800 rounded-sm md:rounded-md"
              />
            );
          }
        })}
      </div>
    </div>
  );
}
