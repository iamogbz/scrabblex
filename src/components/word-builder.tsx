
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
}: WordBuilderProps) {
  const [definition, setDefinition] = useState<string | null>(null);
  const [isFetchingDefinition, setIsFetchingDefinition] = useState(false);

  const { word, score } = useMemo(() => {
    const stagedTilesArray = Object.values(stagedTiles);
    if (stagedTilesArray.length === 0 || tempPlacedTiles.length === 0)
      return { word: "", score: 0 };
    const { score: calculatedScore, words } = calculateMoveScore(
      tempPlacedTiles,
      board
    );
    const mainWordInfo =
      words.find((w) => w.direction === (playDirection || "horizontal")) ||
      words[0];
    return { word: mainWordInfo?.word || "", score: calculatedScore };
  }, [stagedTiles, tempPlacedTiles, board, playDirection]);

  useEffect(() => {
    const stagedWordLetters = [];
    let emptySlotCounter = 0;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.tile) {
        stagedWordLetters.push(slot.tile.letter);
      } else {
        const stagedTile = stagedTiles[emptySlotCounter];
        if (stagedTile) {
          stagedWordLetters.push(stagedTile.letter);
        } else {
          // It's an actual empty space in the word, represented by a placeholder
          stagedWordLetters.push("_");
        }
        emptySlotCounter++;
      }
    }
    const stagedWord = stagedWordLetters.join("").toUpperCase().replace(/_/g, "");
    if (stagedWord && stagedWord.length >= 2) {
      const timer = setTimeout(() => {
        setIsFetchingDefinition(true);
        getWordDefinition(stagedWord)
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
  }, [slots, stagedTiles]);

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
      return definition;
    }
    if (Object.keys(stagedTiles).length > 0) {
      return "Click a slot on the board to place your word.";
    }
    return "Select a slot below, then a tile from your rack to build a word.";
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
            <div key={`staged-${currentIndex}`} className="aspect-square">
              <SingleTile
                tile={tile}
                isDraggable={true}
                isTemp={true}
                onSelect={() => onStagedTileClick(currentIndex)}
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
              {word || "..."} ({word.length}{" "}
              {word.length === 1 ? "letter" : "letters"})
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
