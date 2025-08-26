
"use client";
import { createGame } from "@/app/actions";
import { JoinGameDialog } from "@/components/join-game-dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, X, Home } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LocalStorageKey } from "@/lib/constants";
import { GameState } from "@/types";

interface GameDetails extends GameState {
  updatedAt: string;
}

// A helper function to format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

// A helper function to generate a status string for a game
const getGameStatusText = (game: GameDetails): string => {
  const lastUpdated = formatRelativeTime(new Date(game.updatedAt));
  if (game.gamePhase === "ended") {
    const gameEndMsg = `Ended ${lastUpdated}`;
    if (game.endStatus) {
      return `${game.endStatus}. ${gameEndMsg}`;
    }
    return gameEndMsg;
  }
  const lastUpdatedMsg = `Last updated ${lastUpdated}`;
  if (game.gamePhase === "playing") {
    return `Game in progress. ${lastUpdatedMsg}`;
  }
  return lastUpdatedMsg;
};

export default function PlayPage() {
  const [previousGames, setPreviousGames] = useState<GameDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleRemoveGame = (gameIdToRemove: string) => {
    const updatedGames = previousGames.filter(
      (game) => game.gameId !== gameIdToRemove
    );
    setPreviousGames(updatedGames);

    const updatedGameIds = updatedGames.map((game) => game.gameId);
    localStorage.setItem(LocalStorageKey.GAMES, JSON.stringify(updatedGameIds));
  };

  useEffect(() => {
    const fetchPreviousGames = async () => {
      if (typeof window === "undefined") {
        return;
      }

      setIsLoading(true);
      const history: string[] = JSON.parse(
        localStorage.getItem(LocalStorageKey.GAMES) || "[]"
      );
      const uniqueGameIds = Array.from(new Set<string>(history));

      if (uniqueGameIds.length === 0) {
        setIsLoading(false);
        return;
      }

      // Base URL for fetching raw game data from the 'games' branch
      const GITHUB_RAW_BASE_URL =
        "https://raw.githubusercontent.com/iamogbz/scrabblex/games/";

      try {
        const gameDetailsPromises = uniqueGameIds.map(async (gameId) => {
          try {
            const response = await fetch(
              `${GITHUB_RAW_BASE_URL}${gameId}.json`
            );
            if (!response.ok) {
              console.warn(
                `Failed to fetch game data for ${gameId}. It might be removed from the server.`
              );
              return null;
            }
            const gameState = (await response.json()) as GameState;
            return {
              ...gameState,
              updatedAt:
                gameState.history[gameState.history.length - 1].timestamp || new Date().toISOString(),
            };
          } catch (error) {
            console.error(`Error fetching details for game ${gameId}:`, error);
            return null;
          }
        });

        const fetchedGames = (await Promise.all(gameDetailsPromises)).filter(
          (game): game is NonNullable<typeof game> => game !== null
        );

        // Sort games by last updated date, most recent first
        fetchedGames.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setPreviousGames(fetchedGames);
      } catch (error) {
        console.error(
          "An error occurred while fetching previous games:",
          error
        );
        // Optionally, set an error state to show in the UI
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreviousGames();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-grid-gray-100/[0.1] p-4">
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
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
        <Button variant="ghost" asChild size="icon" className="md:w-auto md:px-4">
          <Link href="/">
            <Home className="h-4 w-4" />
            <span className="hidden md:inline ml-2">Back to Home</span>
          </Link>
        </Button>
      </header>
      <Card className="mt-20 w-full max-w-md text-center shadow-2xl z-10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4">
            <form action={createGame}>
              <Button
                type="submit"
                size="lg"
                className="w-full text-lg py-7 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Plus className="mr-2 h-6 w-6" /> Create New Game
              </Button>
            </form>
            <JoinGameDialog>
              <Button
                variant="outline"
                size="lg"
                className="w-full text-lg py-7"
              >
                <Users className="mr-2 h-6 w-6" /> Join Existing Game
              </Button>
            </JoinGameDialog>
          </div>

          {isLoading && (
            <div className="mt-8">
              <p className="text-muted-foreground">Loading previous games...</p>
            </div>
          )}

          {!isLoading && previousGames.length > 0 && (
            <div className="mt-8 space-y-2">
              <h3 className="text-lg font-semibold">Previous Games</h3>
              <div className="flex flex-col items-center space-y-2">
                {previousGames.map((game) => (
                  <div
                    className="flex flex-row items-center justify-between w-full gap-2 relative"
                    key={game.gameId}
                  >
                    <Link
                      href={`/play/${game.gameId}`}
                      className="flex flex-grow text-primary text-sm "
                    >
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full h-auto text-lg py-3 flex flex-col items-start text-left"
                      >
                        <span className="font-mono text-base">
                          {game.gameId}
                        </span>
                        {getGameStatusText(game)
                          .split(". ")
                          .map((line) => (
                            <span
                              className="text-sm font-normal break-words"
                              key={line}
                            >
                              {line}
                            </span>
                          ))}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 flex-shrink-0 absolute right-2"
                      onClick={() => handleRemoveGame(game.gameId)}
                      aria-label={`Remove game ${game.gameId} from history`}
                    >
                      <X className="h-6 w-6" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
