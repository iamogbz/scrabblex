
"use client"

import type { PlacedTile, Tile, Board, BoardSquare } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import SingleTile from "./tile";
import { Pencil } from "lucide-react";
import { useMemo } from "react";

const calculatePotentialScore = (slots: (PlacedTile | null)[], stagedTiles: PlacedTile[], board: Board): { word: string; score: number } => {
  let word = "";
  let score = 0;
  let wordMultiplier = 1;
  let stagedIndex = 0;
  let tempTilesForCalc: (PlacedTile | BoardSquare)[] = [];

  // Reconstruct the full word with tiles and board positions
  slots.forEach((slot, i) => {
    let tileToProcess: PlacedTile | null = null;
    let boardSquare: BoardSquare | null = null;

    if (slot) { // Existing tile on board
      tileToProcess = slot;
      boardSquare = board[slot.x][slot.y];
      tempTilesForCalc.push(board[slot.x][slot.y]);
    } else if (stagedIndex < stagedTiles.length) { // New tile from player
      tileToProcess = stagedTiles[stagedIndex];
      // We need to figure out the coordinate of this empty slot
      // This part is tricky without the full context from game-client
      // Let's assume for a moment the parent will provide coordinates for staged tiles
      if(tileToProcess.x !== undefined && tileToProcess.y !== undefined) {
         boardSquare = board[tileToProcess.x][tileToProcess.y];
         tempTilesForCalc.push({ ...boardSquare, tile: tileToProcess });
      }
      stagedIndex++;
    }

    if (tileToProcess && boardSquare) {
      word += tileToProcess.letter;
      let letterScore = tileToProcess.points;
      
      // Apply letter multiplier only for newly placed tiles
      const isNewTile = stagedTiles.some(t => t.letter === tileToProcess!.letter && t.points === tileToProcess!.points);
      
      if (isNewTile && boardSquare.multiplierType === 'letter') {
        letterScore *= boardSquare.multiplier;
      }
      
      score += letterScore;

      // Accumulate word multipliers
      if (isNewTile && boardSquare.multiplierType === 'word') {
        wordMultiplier *= boardSquare.multiplier;
      }
    }
  });
  
  // Apply word multipliers
  score *= wordMultiplier;

  // Bingo bonus
  if (stagedTiles.length === 7) {
    score += 50;
  }

  return { word, score };
};


interface WordBuilderProps {
  slots: (PlacedTile | null)[];
  stagedTiles: PlacedTile[];
  onStagedTileClick: (index: number) => void;
  board: Board;
}

export default function WordBuilder({ slots, stagedTiles, onStagedTileClick, board }: WordBuilderProps) {
  
  const { word, score } = useMemo(() => {
    let currentWord = "";
    let wordScore = 0;
    let wordMultiplier = 1;
    let stagedIndex = 0;

    const tempPlacedTiles: PlacedTile[] = [];
    
    slots.forEach(slot => {
        if(!slot && stagedIndex < stagedTiles.length) {
            tempPlacedTiles.push(stagedTiles[stagedIndex]);
            stagedIndex++;
        }
    })

    stagedIndex = 0;
    slots.forEach(slot => {
      let currentTile: Tile | PlacedTile | null = null;
      let boardSquare: BoardSquare | null = null;
      
      if (slot) { // Tile from board
        currentTile = slot;
        boardSquare = board[slot.x][slot.y];
      } else if (stagedIndex < stagedTiles.length) { // Tile from rack
        currentTile = stagedTiles[stagedIndex];
        // This is an approximation, the actual coords are in `tempPlacedTiles` from game-client
        // A better approach would be to pass `tempPlacedTiles` to this component
        const tempTile = tempPlacedTiles[stagedIndex];
        if (tempTile) {
            boardSquare = board[tempTile.x][tempTile.y];
        }
        stagedIndex++;
      }
      
      if (currentTile) {
        currentWord += currentTile.letter;
        let letterScore = currentTile.points;

        const isNew = stagedTiles.some(t => t.letter === currentTile?.letter);

        if (boardSquare && isNew) {
           if (boardSquare.multiplierType === 'letter') {
              letterScore *= boardSquare.multiplier;
           }
           if (boardSquare.multiplierType === 'word') {
              wordMultiplier *= boardSquare.multiplier;
           }
        }
        wordScore += letterScore;
      }
    });

    wordScore *= wordMultiplier;

    if (stagedTiles.length === 7) {
        wordScore += 50;
    }

    return { word: currentWord, score: wordScore };
  }, [slots, stagedTiles, board]);


  const renderSlots = () => {
    const rendered = [];
    let stagedIndex = 0;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot) {
            // Existing tile from the board
            rendered.push(<SingleTile key={`board-${i}`} tile={slot} isDraggable={false} />);
        } else {
            if (stagedIndex < stagedTiles.length) {
                // A tile placed by the player in this turn
                const tile = stagedTiles[stagedIndex];
                const currentIndex = stagedIndex;
                rendered.push(
                    <SingleTile 
                        key={`staged-${currentIndex}`} 
                        tile={tile} 
                        isDraggable={true}
                        isTemp={true}
                        onSelect={() => onStagedTileClick(currentIndex)}
                    />
                );
                stagedIndex++;
            } else {
                // An empty, fillable slot
                rendered.push(<div key={`empty-${i}`} className="aspect-square bg-muted/50 rounded-md border-2 border-dashed" />);
            }
        }
    }
    return rendered;
  };


  return (
    <Card className="shadow-lg animate-in fade-in-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-5 w-5" />
          Word Builder
        </CardTitle>
        <CardDescription>Click tiles from your rack to form a word.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
            {renderSlots()}
        </div>
        {word && (
            <div className="text-center mt-4 p-2 bg-muted rounded-lg">
                <p className="font-bold text-lg tracking-widest">{word}</p>
                <p className="text-sm text-muted-foreground">Potential Score: {score}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
