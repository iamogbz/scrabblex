"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

export function JoinGameDialog({ children }: { children: ReactNode }) {
  const [gameKey, setGameKey] = useState("");
  const router = useRouter();

  const handleJoinGame = () => {
    if (gameKey.trim().length === 6) {
      router.push(`/game/${gameKey.trim().toUpperCase()}`);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Game</DialogTitle>
          <DialogDescription>
            Enter the 6-character game key to join your friends.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="game-key" className="text-right">
              <KeyRound className="inline-block h-5 w-5" />
            </Label>
            <Input
              id="game-key"
              value={gameKey}
              onChange={(e) => setGameKey(e.target.value)}
              placeholder="GAMEID"
              className="col-span-3 uppercase tracking-widest text-lg"
              maxLength={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleJoinGame} className="w-full" disabled={gameKey.length !== 6}>
            Let's Play!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
