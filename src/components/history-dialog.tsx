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
import type { PlayedWord, Player } from "@/types";
import SingleTile from "./tile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface HistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  history: PlayedWord[];
  players: Player[];
}

export function HistoryDialog({
  isOpen,
  onOpenChange,
  history,
  players,
}: HistoryDialogProps) {
  const getMoveDescription = (move: PlayedWord) => {
    if (move.isPass) {
      return (
        <p>
          <span className="font-bold">{move.playerName}</span> passed their
          turn.
        </p>
      );
    }
    if (move.isSwap) {
      return (
        <p>
          <span className="font-bold">{move.playerName}</span> swapped tiles.
        </p>
      );
    }
    if (move.isResign) {
      return (
        <p>
          <span className="font-bold">{move.playerName}</span> resigned.
        </p>
      );
    }
    return (
      <p>
        <span className="font-bold">{move.playerName}</span> played{" "}
        <span className="font-bold text-primary">{move.word}</span> for{" "}
        <span className="font-bold text-primary">{move.score}</span> points.
      </p>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Turn History</DialogTitle>
          <DialogDescription>
            A log of all moves made in the game.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {history.length > 0 ? (
              history
                .filter((move) => move.playerId)
                .slice()
                .reverse()
                .map((move, index) => {
                  const playerName = players.find(
                    (player) => player.id === move.playerId
                  )?.name;
                  move.playerName = playerName || "Unknown";
                  return (
                    <div
                      key={`${move.timestamp}-${index}`}
                      className="flex flex-col p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="text-sm">
                          {getMoveDescription(move)}
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {move.timestamp
                            ? formatDistanceToNow(new Date(move.timestamp), {
                                addSuffix: true,
                              })
                            : "Time ago"}
                        </p>
                      </div>
                      {!move.isPass &&
                        !move.isSwap &&
                        !move.isResign &&
                        move.tiles.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {move.tiles.map((tile, i) => (
                              <div key={i} className="w-8 h-8">
                                <SingleTile tile={tile} isDraggable={false} />
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })
            ) : (
              <p className="text-center text-muted-foreground p-4">
                No moves have been made yet.
              </p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
