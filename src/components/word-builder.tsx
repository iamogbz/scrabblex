
"use client"

import type { PlacedTile, Board, BoardSquare } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import SingleTile from "./tile";
import { Pencil } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { calculateMoveScore } from "@/lib/scoring";
import { getWordDefinition } from "@/app/actions";


interface WordBuilderProps {
  slots: readonly BoardSquare[];
  stagedTiles: PlacedTile[];
  onStagedTileClick: (index: number) => void;
  board: Board;
  tempPlacedTiles: PlacedTile[];
  playDirection: 'horizontal' | 'vertical' | null;
  playerColor?: string;
}

export default function WordBuilder({ slots, stagedTiles, onStagedTileClick, board, tempPlacedTiles, playDirection, playerColor }: WordBuilderProps) {
  const [definition, setDefinition] = useState<string | null>(null);
  const [isFetchingDefinition, setIsFetchingDefinition] = useState(false);

  const { word, score } = useMemo(() => {
    if (tempPlacedTiles.length === 0) return { word: "", score: 0 };
    const { score: calculatedScore, words } = calculateMoveScore(tempPlacedTiles, board);
    const mainWordInfo = words.find(w => w.direction === (playDirection || 'horizontal')) || words[0];
    return { word: mainWordInfo?.word || "", score: calculatedScore };
  }, [tempPlacedTiles, board, playDirection]);

  useEffect(() => {
    const stagedWordLetters = [];
    let stagedIndex = 0;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.tile) {
            // Existing tile from the board
            stagedWordLetters.push(slot.tile.letter);
        } else {
            if (stagedIndex < stagedTiles.length) {
                // A tile placed by the player in this turn
                stagedWordLetters.push(stagedTiles[stagedIndex].letter);
                stagedIndex++;
            } else {
                // An empty, fillable slot
                break
            }
        }
    }
    const stagedWord = stagedWordLetters.join('').toUpperCase();
    console.log("Staged word:", stagedWord);
    // Only fetch definition if the staged word is at least 2 characters long
    if (stagedWord && stagedWord.length >= 2) {
      setIsFetchingDefinition(true);
      const timer = setTimeout(() => {
        getWordDefinition(stagedWord).then(def => {
          setDefinition(def);
          setIsFetchingDefinition(false);
        });
      }, 500); // Debounce to avoid too many API calls

      return () => clearTimeout(timer);
    } else {
      setDefinition(null);
    }
  }, [slots, tempPlacedTiles]);

  const getMultiplierText = (square: BoardSquare) => {
    if (square.isCenter) return "★";
    if (square.multiplierType === 'word') return `${square.multiplier}W`;
    if (square.multiplierType === 'letter') return `${square.multiplier}L`;
    return '';
  };

  const renderDescription = () => {
    if (isFetchingDefinition) {
      return "Looking up word...";
    }
    if (definition) {
      return definition;
    }
    return "Click tiles from your rack to form a word.";
  };

  const renderSlots = () => {
    const rendered = [];
    let stagedIndex = 0;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.tile) {
            // Existing tile from the board
            rendered.push(<SingleTile key={`board-${i}`} tile={slot.tile} isDraggable={false} />);
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
                rendered.push(
                  <div
                    key={`empty-${i}`}
                    className="aspect-square bg-muted/50 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground"
                  >
                    <span className="text-xs font-bold opacity-70 select-none">
                      {getMultiplierText(slot)}
                    </span>
                  </div>
                );
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
        <CardDescription>{renderDescription()}</CardDescription>
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
