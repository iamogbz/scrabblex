"use client";

import { use, useState, useEffect } from "react";
import { getGameState } from "@/app/actions";
import { GameState } from "@/types";
import { CrosswordBoard } from "@/components/crossword-board";
import { Logo } from "@/components/logo";
import { Home, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function SolveGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completionDate, setCompletionDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchGame = async () => {
      setLoading(true);
      setError(null);
      try {
        const gameData = await getGameState(gameId);
        if (gameData) {
          if (gameData.gameState.gamePhase !== "ended") {
            setError("This game has not been completed yet.");
          } else {
            setGameState(gameData.gameState);
            if (gameData.gameState.history.length > 0) {
              const lastMoveTimestamp =
                gameData.gameState.history[
                  gameData.gameState.history.length - 1
                ].timestamp;
              setCompletionDate(
                formatDistanceToNow(new Date(lastMoveTimestamp), {
                  addSuffix: true,
                })
              );
            }
          }
        } else {
          setError(`Game with ID "${gameId}" not found.`);
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load game data.");
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-grid-gray-100/[0.1] p-4">
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
        <Link
          href="/"
          className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
        >
          <Logo className="w-8 h-8" />
          <span className="font-headline text-2xl tracking-wider">
            Scrabblex
          </span>
        </Link>
        <TooltipProvider>
          <div className="flex items-center gap-1 md:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  asChild
                  size="icon"
                  className="md:w-auto md:px-4"
                >
                  <Link href="/solve">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden md:inline ml-2">
                      Back to Puzzles
                    </span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">
                <p>Back to Puzzles</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  asChild
                  size="icon"
                  className="md:w-auto md:px-4"
                >
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span className="hidden md:inline ml-2">Back to Home</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">
                <p>Back to Home</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      <div className="w-full max-w-5xl text-center mt-20 z-10">
        {loading && (
          <div className="text-center p-10 flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin h-5 w-5" /> Loading Puzzle...
          </div>
        )}

        {error && (
          <Card className="shadow-xl border-destructive max-w-md mx-auto">
            <CardHeader>
              <div className="mx-auto bg-destructive text-destructive-foreground rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl text-destructive">
                Error Loading Puzzle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error}</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="secondary" asChild>
                  <Link href="/solve">Back to Puzzles</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {gameState && (
          <>
            <h1 className="text-2xl font-headline tracking-wider mb-2">
              {gameState.crosswordTitle || `Puzzle ${gameId.toUpperCase()}`}
            </h1>
            <p className="text-muted-foreground mb-4 text-sm">
              {completionDate
                ? `Uploaded ${completionDate}`
                : "A generated puzzle."}
            </p>
            <CrosswordBoard gameState={gameState} />
          </>
        )}
      </div>
    </main>
  );
}
