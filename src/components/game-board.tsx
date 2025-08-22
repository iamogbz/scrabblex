
"use client";

import type { BoardSquare, PlacedTile, Tile } from "@/types";
import { cn } from "@/lib/utils";
import SingleTile from "./tile";
import { Star } from "lucide-react";

interface GameBoardProps {
  board: BoardSquare[][];
  tempPlacedTiles: PlacedTile[];
  onSquareClick: (x: number, y: number) => void;
  selectedTile: { tile: Tile; index: number } | null;
  validPlacementSquares: { x: number; y: number }[];
}

export default function GameBoard({ board, tempPlacedTiles, onSquareClick, selectedTile, validPlacementSquares }: GameBoardProps) {
  const getSquareContent = (square: BoardSquare, x: number, y: number) => {
    const tempTile = tempPlacedTiles.find(t => t.x === x && t.y === y);
    if (tempTile) {
      return <SingleTile tile={tempTile} isDraggable={false} isTemp={true} />;
    }
    if (square.tile) {
      return <SingleTile tile={square.tile} isDraggable={false} />;
    }
    return null;
  };

  const getMultiplierText = (square: BoardSquare) => {
    if (square.isCenter) return <Star className="h-4 w-4 md:h-6 md:w-6 opacity-50" />;
    if (square.multiplierType === 'word') return `${square.multiplier}W`;
    if (square.multiplierType === 'letter') return `${square.multiplier}L`;
    return '';
  };

  return (
    <div className="aspect-square w-full max-w-[70vh] mx-auto bg-background rounded-lg shadow-lg p-2 md:p-4 border">
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 md:gap-1 h-full w-full">
        {board.map((row, x) =>
          row.map((square, y) => {
            const content = getSquareContent(square, x, y);
            const isValidPlacement = validPlacementSquares.some(s => s.x === x && s.y === y);
            return (
              <div
                key={`${x}-${y}`}
                onClick={() => onSquareClick(x, y)}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-[2px] md:rounded-md transition-colors",
                  square.multiplierType === 'word' && square.multiplier === 3 && 'bg-red-200/50 text-red-800',
                  square.multiplierType === 'word' && square.multiplier === 2 && 'bg-purple-200/50 text-purple-800',
                  square.multiplierType === 'letter' && square.multiplier === 3 && 'bg-blue-200/50 text-blue-800',
                  square.multiplierType === 'letter' && square.multiplier === 2 && 'bg-green-200/50 text-green-800',
                  !square.tile && !content && 'bg-muted/30',
                  square.isCenter && 'bg-purple-200/50 text-purple-800',
                  !!selectedTile && !content && 'cursor-pointer',
                  isValidPlacement && !content && 'bg-accent/20 hover:bg-accent/40',
                )}
              >
                {content || <span className="text-[8px] md:text-xs font-bold opacity-70 select-none">{getMultiplierText(square)}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
