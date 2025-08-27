
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
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

interface BlankTileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (letter: string) => void;
  onReturnToRack?: () => void;
  showReturnToRack: boolean;
}

export function BlankTileDialog({
  isOpen,
  onOpenChange,
  onSelect,
  onReturnToRack,
  showReturnToRack,
}: BlankTileDialogProps) {
  const [letter, setLetter] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLetter("");
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (letter.match(/^[A-Z]$/)) {
      onSelect(letter);
      onOpenChange(false);
    }
  };

  const handleReturn = () => {
    if (onReturnToRack) {
      onReturnToRack();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle>Choose a Letter</DialogTitle>
          <DialogDescription>
            Select a letter for your blank tile.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center gap-2 my-4">
          <Input
            value={letter}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              if (val.length <= 1 && val.match(/^[A-Z]*$/)) {
                setLetter(val);
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            maxLength={1}
            // Keep text as large otherwise it is clipped by the input field
            className="w-20 h-20 text-l text-center font-bold uppercase"
          />
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          {showReturnToRack ? (
            <Button variant="outline" onClick={handleReturn}>
              <RotateCcw className="mr-2 h-4 w-4" /> Return to Rack
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!letter}>
              Select
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
