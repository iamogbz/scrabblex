
"use client"

import type { PlacedTile, Board } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import SingleTile from "./tile";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import { calculateMoveScore } from "@/lib/scoring";


interface WordBuilderProps {
  slots: readonly(PlacedTile | null)[];
  stagedTiles: PlacedTile[];
  onStagedTileClick: (index: number) => void;
  board: Board;
  tempPlacedTiles: PlacedTile[];
  playDirection: 'horizontal' | 'vertical' | null;
  playerColor?: string;
}

export default function WordBuilder({ slots, stagedTiles, onStagedTileClick, board, tempPlacedTiles, playDirection, playerColor }: WordBuilderProps) {
  const { word, score } = useMemo(() => {
    if (tempPlacedTiles.length === 0) return { word: "", score: 0 };
    const { score: calculatedScore, words } = calculateMoveScore(tempPlacedTiles, board);
    const mainWordInfo = words.find(w => w.direction === (playDirection || 'horizontal')) || words[0];
    return { word: mainWordInfo?.word || "", score: calculatedScore };
  }, [tempPlacedTiles, board, playDirection]);


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
                        playerColor={playerColor}
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
        {stagedTiles.length > 0 && (
            <div className="text-center mt-4 p-2 bg-muted rounded-lg">
                <p className="font-bold text-lg tracking-widest">{word || "..."}</p>
                <p className="text-sm text-muted-foreground">Potential Score: {score}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
