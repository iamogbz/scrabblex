
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEffect, useRef, useState } from "react";
import SingleTile from "./tile";
import type { BoardSquare, PlacedTile } from "@/types";

interface CrosswordGuessDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  wordInfo: {
    number: number;
    word: string;
    clue: string;
    direction: "across" | "down";
    x: number;
    y: number;
    length: number;
  } | null;
  board: (PlacedTile | null)[][];
  onGuess: (guess: string) => void;
}

export function CrosswordGuessDialog({
  isOpen,
  onOpenChange,
  wordInfo,
  board,
  onGuess,
}: CrosswordGuessDialogProps) {
  const [guess, setGuess] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wordInfo) {
      const initialGuess = Array(wordInfo.length).fill("");
      for (let i = 0; i < wordInfo.length; i++) {
        const x =
          wordInfo.direction === "down" ? wordInfo.x + i : wordInfo.x;
        const y =
          wordInfo.direction === "across" ? wordInfo.y + i : wordInfo.y;
        if (board[x]?.[y]) {
          initialGuess[i] = board[x][y]!.letter;
        }
      }
      setGuess(initialGuess);
      inputRefs.current = inputRefs.current.slice(0, wordInfo.length);
    } else {
        setGuess([])
    }
  }, [wordInfo, board]);

  const handleInputChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newGuess = [...guess];
    const value = e.target.value.toUpperCase();
    newGuess[index] = value;
    setGuess(newGuess);

    if (value && index < wordInfo!.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !guess[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
    }
  }

  const handleSubmit = () => {
    onGuess(guess.join(""));
    onOpenChange(false);
  };

  if (!wordInfo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {wordInfo.number}. {wordInfo.direction === 'across' ? 'Across' : 'Down'}
          </DialogTitle>
          <DialogDescription>{wordInfo.clue}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center gap-1 md:gap-2 my-4">
          {Array.from({ length: wordInfo.length }).map((_, i) => {
            const x = wordInfo!.direction === 'down' ? wordInfo!.x + i : wordInfo!.x;
            const y = wordInfo!.direction === 'across' ? wordInfo!.y + i : wordInfo!.y;
            const existingTile = board[x]?.[y];
            
            if (existingTile) {
                return (
                    <div key={i} className="w-10 h-10 md:w-12 md:h-12">
                        <SingleTile tile={existingTile} isDraggable={false} />
                    </div>
                )
            }

            return (
              <Input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                maxLength={1}
                value={guess[i] || ""}
                onChange={(e) => handleInputChange(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-10 h-10 md:w-12 md:h-12 text-center text-2xl font-bold uppercase"
              />
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={guess.some(g => !g)}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
