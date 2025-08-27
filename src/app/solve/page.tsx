
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cross, Home } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { GameState, PlacedTile } from "@/types";
import { GITHUB_BRANCH_GAMES, GITHUB_USER_REPO } from "@/lib/game-service";

interface GameDetails extends GameState {
  updatedAt: string;
  totalWords: number;
  completedWords: number;
}

const getWordsFromGameState = (gameState: GameState) => {
    const board = Array.from({ length: 15 }, () => Array(15).fill(null)) as (PlacedTile | null)[][];
    gameState.history.forEach(move => {
        if (move.tiles) {
            move.tiles.forEach((tile: PlacedTile) => {
                board[tile.x][tile.y] = tile;
            });
        }
    });

    const wordsList: { word: string; x: number; y: number; direction: 'across' | 'down' }[] = [];
    const wordStartPositions: { [key: string]: boolean } = {};

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if (!board[r][c]) continue;

            const isAcrossStart = (c === 0 || !board[r][c - 1]) && c < 14 && board[r][c + 1];
            const isDownStart = (r === 0 || !board[r - 1]?.[c]) && r < 14 && board[r + 1]?.[c];
            
            if(isAcrossStart) {
                let word = '';
                let length = 0;
                for (let i = c; i < 15 && board[r][i]; i++) {
                    word += board[r][i]!.letter;
                    length++;
                }
                if (length > 1) wordsList.push({ word, x: r, y: c, direction: 'across' });
            }

            if(isDownStart) {
                let word = '';
                let length = 0;
                for (let i = r; i < 15 && board[i]?.[c]; i++) {
                    word += board[i][c]!.letter;
                    length++;
                }
                if (length > 1) wordsList.push({ word, x: r, y: c, direction: 'down' });
            }
        }
    }
     // Remove duplicates
    return Array.from(new Map(wordsList.map(w => [`${w.word}-${w.x}-${w.y}`, w])).values());
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
    const percentage = game.totalWords > 0 ? Math.round((game.completedWords / game.totalWords) * 100) : 0;
    const lastUpdated = formatRelativeTime(new Date(game.updatedAt));
    return `${percentage}% complete. ${game.totalWords} words. Uploaded ${lastUpdated}.`;
};

export default function SolvePage() {
  const [completedGames, setCompletedGames] = useState<GameDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompletedGames = async () => {
      setIsLoading(true);
      const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER_REPO}/contents/?ref=heads/${GITHUB_BRANCH_GAMES}`;
      const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USER_REPO}/games/`;

      try {
        const response = await fetch(GITHUB_API_URL);
        if (!response.ok) {
          throw new Error("Failed to fetch game list from GitHub.");
        }
        const files: { name: string; type: string }[] = await response.json();
        const gameFiles = files.filter(
          (file) => file.type === "file" && file.name.endsWith(".json")
        );

        const gameDetailsPromises = gameFiles.map(async (file) => {
          try {
            const gameId = file.name.replace(".json", "");
            const gameResponse = await fetch(
              `${GITHUB_RAW_BASE_URL}${file.name}?ref=heads/${GITHUB_BRANCH_GAMES}`
            );
            if (!gameResponse.ok) {
              console.warn(
                `Failed to fetch game data for ${gameId}. It might be removed from the server.`
              );
              return null;
            }
            const gameState = (await gameResponse.json()) as GameState;

            if (gameState.gamePhase === "ended") {
              const wordsInPuzzle = getWordsFromGameState(gameState);
              const userInputs: Record<string, string> = JSON.parse(localStorage.getItem(`crossword-${gameId}-inputs`) || '{}');
              
              let completedWords = 0;
              wordsInPuzzle.forEach(wordInfo => {
                  let isCorrect = true;
                  for (let i = 0; i < wordInfo.word.length; i++) {
                      const x = wordInfo.direction === 'down' ? wordInfo.x + i : wordInfo.x;
                      const y = wordInfo.direction === 'across' ? wordInfo.y + i : wordInfo.y;
                      const key = `${x},${y}`;
                      if ((userInputs[key] || '').toUpperCase() !== wordInfo.word[i]) {
                          isCorrect = false;
                          break;
                      }
                  }
                  if (isCorrect) completedWords++;
              });

              return {
                ...gameState,
                updatedAt:
                  gameState.history.length > 0
                    ? gameState.history[
                        gameState.history.length - 1
                      ].timestamp
                    : new Date(0).toISOString(), // Fallback for games with no history
                totalWords: wordsInPuzzle.length,
                completedWords,
              };
            }
            return null;
          } catch (error) {
            console.error(
              `Error fetching details for game ${file.name}:`,
              error
            );
            return null;
          }
        });

        const fetchedGames = (await Promise.all(gameDetailsPromises)).filter(
          (game): game is GameDetails => game !== null
        );

        // Sort games by last updated date, most recent first
        fetchedGames.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setCompletedGames(fetchedGames);
      } catch (error) {
        console.error(
          "An error occurred while fetching completed games:",
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompletedGames();
  }, []);

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-grid-gray-100/[0.1] p-4">
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
      <Card className="w-full text-center shadow-2xl z-10 border-primary/20 mt-20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center mb-4">
             <Cross className="h-12 w-12 text-primary mb-2" />
             <h1 className="text-3xl font-headline tracking-wider mb-2">Crosswords</h1>
             <p className="text-muted-foreground">Solve puzzles based on completed scrabble games.</p>
          </div>

          {isLoading && (
            <div className="mt-8">
              <p className="text-muted-foreground">Loading completed games...</p>
            </div>
          )}

          {!isLoading && completedGames.length === 0 && (
             <div className="flex flex-col items-center mt-4 gap-4 text-center text-muted-foreground">
                <p>No completed games found yet.</p>
                <Button variant="outline">
                  <Link href="/play">
                    <p>Go play a few rounds!</p>
                  </Link>
                </Button>
             </div>
          )}

          {!isLoading && completedGames.length > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-2">
                {completedGames.map((game) => (
                  <Link
                    href={`/solve/${game.gameId}`}
                    key={game.gameId}
                    className="flex text-primary text-sm"
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
                            className="text-sm font-normal break-words whitespace-normal"
                            key={line}
                          >
                            {line}
                          </span>
                        ))}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
