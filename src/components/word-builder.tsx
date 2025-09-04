
"use client";

import type { PlacedTile, Board, BoardSquare } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import SingleTile from "./tile";
import { WholeWord } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { calculateMoveScore } from "@/lib/scoring";
import { getWordDefinition } from "@/app/actions";
import { cn } from "@/lib/utils";
import { INVALID_WORD_ERROR, NO_API_KEY_ERROR, UNDEFINED_WORD_VALID } from "@/lib/constants";

interface WordBuilderProps {
  slots: readonly BoardSquare[];
  stagedTiles: Record<number, PlacedTile>;
  onStagedTileClick: (index: number) => void;
  onBuilderSlotClick: (index: number) => void;
  selectedBuilderIndex: number | null;
  board: Board;
  tempPlacedTiles: PlacedTile[];
  playDirection: "horizontal" | "vertical" | null;
  playerColor?: string;
  onBlankTileReassign: (index: number) => void;
}

export default function WordBuilder({
  slots,
  stagedTiles,
  onStagedTileClick,
  onBuilderSlotClick,
  selectedBuilderIndex,
  board,
  tempPlacedTiles,
  playDirection,
  playerColor,
  onBlankTileReassign,
}: WordBuilderProps) {
  const [definition, setDefinition] = useState<string | null>(null);
  const [isFetchingDefinition, setIsFetchingDefinition] = useState(false);

  const { word, score } = useMemo(() => {
    if (Object.keys(stagedTiles).length === 0 && tempPlacedTiles.length === 0) {
      return { word: "", score: 0 };
    }

    const currentWordTiles: (PlacedTile | BoardSquare)[] = [];
    let currentWord = "";
    let emptySlotCounter = 0;

    for (const slot of slots) {
      if (slot.tile) {
        currentWordTiles.push(slot);
        currentWord += slot.tile.letter;
      } else {
        const stagedTile = stagedTiles[emptySlotCounter];
        if (stagedTile) {
          currentWordTiles.push(stagedTile);
          currentWord += stagedTile.letter;
        } else {
          // Break on the first empty slot to only score the contiguous word
          break;
        }
        emptySlotCounter++;
      }
    }
    
    if (tempPlacedTiles.length > 0) {
      const { score: calculatedScore, words } = calculateMoveScore(
        tempPlacedTiles,
        board
      );

      if (words.length > 0) {
        // Try to find the main word based on the play direction
        let mainWordInfo = words.find(w => w.direction === playDirection);
        // If no word matches the play direction (e.g. single tile play), find the longest word.
        if (!mainWordInfo) {
          mainWordInfo = words.reduce((longest, current) => current.word.length > longest.word.length ? current : longest, words[0]);
        }
         return { word: mainWordInfo?.word || "", score: calculatedScore };
      }
    }

    // Fallback to a simple concatenation if no valid placement yet.
    // This allows definition lookup while planning.
    return { word: currentWord, score: 0 };
  }, [stagedTiles, slots, tempPlacedTiles, board, playDirection]);


  useEffect(() => {
    if (word && word.length >= 2) {
      const timer = setTimeout(() => {
        setIsFetchingDefinition(true);
        getWordDefinition(word)
          .then((def) => {
            setDefinition(def);
          })
          .finally(() => {
            setIsFetchingDefinition(false);
          });
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setDefinition(null);
    }
  }, [word]);

  const getMultiplierText = (square: BoardSquare) => {
    if (square.isCenter) return "★";
    if (square.multiplierType === "word") return `${square.multiplier}W`;
    if (square.multiplierType === "letter") return `${square.multiplier}L`;
    return "";
  };

  const renderDescription = () => {
    if (isFetchingDefinition) {
      return "Looking up word...";
    }
    if (definition) {
       if (definition === UNDEFINED_WORD_VALID || ![INVALID_WORD_ERROR, NO_API_KEY_ERROR].includes(definition)) {
          return definition;
       }
    }
    if (selectedBuilderIndex !== null && stagedTiles[selectedBuilderIndex]) {
       return "Click an empty slot to move, or another tile to swap.";
    }
    if (selectedBuilderIndex !== null) {
        return "Now select a tile from your rack to place it here.";
    }
    return "Select a slot below to begin building a word.";
  };

  const renderSlots = () => {
    const rendered = [];
    let emptySlotCounter = 0;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.tile) {
        rendered.push(
          <div key={`board-${i}`} className="aspect-square">
            <SingleTile tile={slot.tile} isDraggable={false} />
          </div>
        );
      } else {
        const currentIndex = emptySlotCounter;
        const tile = stagedTiles[currentIndex];
        if (tile) {
          rendered.push(
            <div
              key={`staged-${currentIndex}`}
              className="aspect-square"
              onClick={() => {
                if (tile.originalLetter === ' ') {
                  onBlankTileReassign(currentIndex);
                } else {
                  onStagedTileClick(currentIndex);
                }
              }}
            >
              <SingleTile
                tile={tile}
                isDraggable={true}
                isTemp={true}
                isSelected={selectedBuilderIndex === currentIndex}
                playerColor={playerColor}
              />
            </div>
          );
        } else {
          rendered.push(
            <div
              key={`empty-${currentIndex}`}
              className={cn(
                "aspect-square bg-muted/50 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground cursor-pointer transition-colors",
                selectedBuilderIndex === currentIndex
                  ? "ring-2 ring-accent ring-offset-2"
                  : "hover:bg-muted"
              )}
              onClick={() => onBuilderSlotClick(currentIndex)}
            >
              <span className="text-xs font-bold opacity-70 select-none">
                {getMultiplierText(slot)}
              </span>
            </div>
          );
        }
        emptySlotCounter++;
      }
    }
    return rendered;
  };

  return (
    <Card className="shadow-lg animate-in fade-in-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WholeWord className="h-5 w-5" />
          Word Planner
        </CardTitle>
        <CardDescription>{renderDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 md:gap-2">{renderSlots()}</div>
        {Object.keys(stagedTiles).length > 0 && word.length > 0 && (
          <div className="text-center mt-4 p-2 bg-muted rounded-lg">
            <p className="font-bold text-lg tracking-widest">
              {word || "..."}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({word.length} {word.length === 1 ? "letter" : "letters"})
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Potential Score: {score}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
