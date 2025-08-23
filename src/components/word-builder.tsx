
"use client"

import type { PlacedTile, Tile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import SingleTile from "./tile";
import { Pencil } from "lucide-react";
import { useMemo } from "react";

interface WordBuilderProps {
  slots: (PlacedTile | null)[];
  stagedTiles: PlacedTile[];
  onStagedTileClick: (index: number) => void;
}

export default function WordBuilder({ slots, stagedTiles, onStagedTileClick }: WordBuilderProps) {
  const { word, score } = useMemo(() => {
    let currentWord = "";
    let currentScore = 0;
    let stagedIndex = 0;
    
    slots.forEach(slot => {
      if (slot) {
        currentWord += slot.letter;
        currentScore += slot.points;
      } else if (stagedIndex < stagedTiles.length) {
        const tile = stagedTiles[stagedIndex];
        currentWord += tile.letter;
        currentScore += tile.points;
        stagedIndex++;
      }
    });

    return { word: currentWord, score: currentScore };
  }, [slots, stagedTiles]);

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
                <p className="text-sm text-muted-foreground">Score: {score}</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
