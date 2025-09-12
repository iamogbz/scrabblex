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
  userInputs: Record<string, string>;
  onGuess: (guess: string) => void;
  revealedCells: string[];
}

export function CrosswordGuessDialog({
  isOpen,
  onOpenChange,
  wordInfo,
  userInputs,
  onGuess,
  revealedCells,
}: CrosswordGuessDialogProps) {
  const [guess, setGuess] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wordInfo) {
      const initialGuess = Array(wordInfo.length).fill("");
      for (let i = 0; i < wordInfo.length; i++) {
        const x = wordInfo.direction === "down" ? wordInfo.x + i : wordInfo.x;
        const y = wordInfo.direction === "across" ? wordInfo.y + i : wordInfo.y;
        const key = `${x},${y}`;
        if (userInputs[key]) {
          initialGuess[i] = userInputs[key];
        }
      }
      setGuess(initialGuess);
      inputRefs.current = inputRefs.current.slice(0, wordInfo.length);
    } else {
      setGuess([]);
    }
  }, [isOpen, wordInfo, userInputs]);

  const handleInputChange = (
    index: number,
    e?: React.FormEvent<HTMLInputElement>
  ) => {
    const existingChar = guess[index];
    const inputEl = inputRefs.current[index]!;
    const inputValue = inputEl.value.toUpperCase();
    // Get last new character in case of pasting or overwrite
    const lastChar =
      inputValue &&
      (inputValue.replace(existingChar, "").slice(-1) || existingChar);
    const newGuess = [...guess];
    newGuess[index] = lastChar;
    setGuess(newGuess);
    // update input value to be single character
    inputEl.value = lastChar;

    if (lastChar && index < wordInfo!.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      // focus on previous input if guess was empty
      if (!guess[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      // clear input and trigger change handler
      inputRefs.current[index]!.value = "";
      handleInputChange(index);
    }
  };

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
            {wordInfo.number}.{" "}
            {wordInfo.direction === "across" ? "Across" : "Down"}
          </DialogTitle>
          <DialogDescription>{wordInfo.clue}</DialogDescription>
        </DialogHeader>
        <div
          className="flex justify-center items-center gap-2 mt-4 mb-8"
          style={{
            containerType: "size",
          }}
        >
          {Array.from({ length: wordInfo.length }).map((_, i) => {
            const x =
              wordInfo.direction === "down" ? wordInfo.x + i : wordInfo.x;
            const y =
              wordInfo.direction === "across" ? wordInfo.y + i : wordInfo.y;
            const key = `${x},${y}`;
            const isRevealed = revealedCells.includes(key);

            return (
              <Input
                key={i}
                ref={(el) => void (inputRefs.current[i] = el)}
                type="text"
                maxLength={2}
                value={guess[i] || ""}
                onInput={(e) => handleInputChange(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                readOnly={isRevealed}
                style={{
                  caretColor: "transparent",
                  // 16px is used as minimum to avoid auto zoom on mobile
                  fontSize: "clamp(16px, 0.8rem, 40px)",
                }}
                className={`w-12 h-12 text-center font-bold uppercase ${
                  isRevealed
                    ? "text-green-700 bg-green-200 border-green-400"
                    : ""
                }`}
              />
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={guess.join("").length === 0}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
