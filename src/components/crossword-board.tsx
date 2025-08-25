"use client";

import type { GameState, PlacedTile } from "@/types";
import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import CrosswordTile from "./crossword-tile";
import { getWordDefinitions } from "@/app/actions";
import { Button } from "./ui/button";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Check, RotateCcw, RefreshCw, Focus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CrosswordBoardProps {
  gameState: GameState;
}

interface Word {
  number: number;
  word: string;
  clue: string;
  direction: "across" | "down";
  x: number;
  y: number;
  length: number;
}

export function CrosswordBoard({ gameState }: CrosswordBoardProps) {
  const [words, setWords] = useState<Omit<Word, "clue">[]>([]);
  const [clues, setClues] = useLocalStorage<Record<string, string>>(
    `crossword-${gameState.gameId}-clues`,
    {}
  );
  const [isLoadingClues, setIsLoadingClues] = useState(true);

  const [revealedCells, setRevealedCells] = useLocalStorage<string[]>(
    `crossword-${gameState.gameId}-revealed`,
    []
  );
  const [userInputs, setUserInputs] = useLocalStorage<Record<string, string>>(
    `crossword-${gameState.gameId}-inputs`,
    {}
  );
  const [activeCell, setActiveCell] = useState<{ x: number; y: number } | null>(
    null
  );

  const isMobile = useIsMobile();

  // dynamically calculate the height of the element with id board-container
  const [boardContainerElem, setBoardContainerElem] =
    useState<HTMLDivElement | null>(null);
  const [boardContainerHeight, setBoardContainerHeight] = useState(400);

  const { board, wordStartPositions, playedTilesCoords } = useMemo(() => {
    const board = Array.from({ length: 15 }, () =>
      Array(15).fill(null)
    ) as (PlacedTile | null)[][];
    const coords = new Set<string>();

    gameState.history.forEach((move) => {
      if (move.tiles) {
        move.tiles.forEach((tile: PlacedTile) => {
          board[tile.x][tile.y] = tile;
          coords.add(`${tile.x},${tile.y}`);
        });
      }
    });

    const wordStartPositions: { [key: string]: number } = {};
    const wordsList: Omit<Word, "clue">[] = [];
    let wordNumber = 1;

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (!board[r][c]) continue;

        const isAcrossStart =
          (c === 0 || !board[r][c - 1]) && c < 14 && board[r][c + 1];
        const isDownStart =
          (r === 0 || !board[r - 1]?.[c]) && r < 14 && board[r + 1]?.[c];

        if (isAcrossStart || isDownStart) {
          const key = `${r},${c}`;
          if (!wordStartPositions[key]) {
            wordStartPositions[key] = wordNumber++;
          }
        }

        if (isAcrossStart) {
          let word = "";
          let length = 0;
          for (let i = c; i < 15 && board[r][i]; i++) {
            word += board[r][i]!.letter;
            length++;
          }
          if (length > 1) {
            wordsList.push({
              number: wordStartPositions[`${r},${c}`],
              word,
              direction: "across",
              x: r,
              y: c,
              length,
            });
          }
        }

        if (isDownStart) {
          let word = "";
          let length = 0;
          for (let i = r; i < 15 && board[i][c]; i++) {
            word += board[i][c]!.letter;
            length++;
          }
          if (length > 1) {
            wordsList.push({
              number: wordStartPositions[`${r},${c}`],
              word,
              direction: "down",
              x: r,
              y: c,
              length,
            });
          }
        }
      }
    }
    // Remove duplicates that might arise from single-letter intersections
    const uniqueWords = Array.from(
      new Map(wordsList.map((w) => [`${w.word}-${w.x}-${w.y}`, w])).values()
    );
    uniqueWords.sort((a, b) => a.number - b.number);
    setWords(uniqueWords);

    return { board, wordStartPositions, playedTilesCoords: coords };
  }, [gameState.history]);

  const fetchClues = useCallback(async () => {
    if (words.length === 0) return;

    // Check if all clues are already cached
    const allCluesCached = words.every((word) => !!clues[word.word]);
    if (allCluesCached) {
      setIsLoadingClues(false);
      return;
    }

    setIsLoadingClues(true);
    const wordsToFetch = words.filter((w) => !clues[w.word]).map((w) => w.word);

    try {
      const definitions = await getWordDefinitions(wordsToFetch);
      const newClues: Record<string, string> = {};
      for (const word in definitions) {
        newClues[word] = definitions[word] || `A ${word.length}-letter word.`;
      }
      setClues((prev) => ({ ...prev, ...newClues }));
    } catch (e) {
      console.error("Failed to fetch clues", e);
      // Set a fallback clue on error
      const errorClues: Record<string, string> = {};
      wordsToFetch.forEach((word) => {
        errorClues[
          word
        ] = `Could not load clue for this ${word.length}-letter word.`;
      });
      setClues((prev) => ({ ...prev, ...errorClues }));
    } finally {
      setIsLoadingClues(false);
    }
  }, [words, clues, setClues]);

  useEffect(() => {
    fetchClues();
  }, [fetchClues]);

  const getTileFor = (x: number, y: number): PlacedTile | null => {
    for (let i = gameState.history.length - 1; i >= 0; i--) {
      const move = gameState.history[i];
      if (move.tiles) {
        const tile = move.tiles.find((t) => t.x === x && t.y === y);
        if (tile) return tile;
      }
    }
    const boardTile = gameState.board[x]?.[y]?.tile;
    if (boardTile) return boardTile;
    return null;
  };

  const handleInputChange = (x: number, y: number, value: string) => {
    const key = `${x},${y}`;
    const newInputs = { ...userInputs, [key]: value.toUpperCase() };
    setUserInputs(newInputs);

    const tile = getTileFor(x, y);
    if (tile && value.toUpperCase() === tile.letter) {
      setRevealedCells((prev) => [...new Set([...prev, key])]);
    }
  };

  const handleFocusWord = (word: Omit<Word, "clue">) => {
    const tileElement = document.getElementById(`tile-${word.x}-${word.y}`);
    if (tileElement) {
      window.scrollTo({
        top: boardContainerHeight - tileElement.offsetTop,
        behavior: "smooth",
      });
      // Find the input within the tile and focus it
      const input = tileElement.querySelector("input");
      if (input) {
        input.focus();
      }
    }
  };

  const handleReset = () => {
    setRevealedCells([]);
    setUserInputs({});
    setActiveCell(null);
  };

  const handleCheck = () => {
    const correctCells = Object.keys(userInputs).filter((key) => {
      const [x, y] = key.split(",").map(Number);
      const tile = getTileFor(x, y);
      return tile && userInputs[key] === tile.letter;
    });
    setRevealedCells((prev) => [...new Set([...prev, ...correctCells])]);
  };

  const acrossClues = words.filter((w) => w.direction === "across");
  const downClues = words.filter((w) => w.direction === "down");

  const renderClueList = (wordList: Omit<Word, "clue">[]) => {
    if (isLoadingClues && Object.keys(clues).length === 0) {
      return (
        <div className="flex items-center justify-center p-4">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading clues...
        </div>
      );
    }
    return wordList.map((word) => (
      <div
        key={word.number + word.direction}
        className="text-sm mb-2 flex items-start text-left"
      >
        <span className="font-bold w-8">{word.number}.</span>
        <span className="flex-1">
          {clues[word.word] || (
            <span className="text-muted-foreground italic">Fetching...</span>
          )}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-2"
          onClick={() => handleFocusWord(word)}
        >
          <Focus className="h-4 w-4" />
        </Button>
      </div>
    ));
  };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;

  Array.from({ length: 15 * 15 }).forEach((_, index) => {
    const x = Math.floor(index / 15);
    const y = index % 15;
    const coordString = `${x},${y}`;
    if (playedTilesCoords.has(coordString)) {
      if (x < minX) {
        minX = x;
      } else if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      } else if (y > maxY) {
        maxY = y;
      }
    }
  });

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setBoardContainerHeight(entry.contentRect.height);
      }
    });

    if (boardContainerElem) {
      observer.observe(boardContainerElem);
    }

    return () => {
      if (boardContainerElem) {
        observer.unobserve(boardContainerElem);
      }
      observer.disconnect();
    };
  }, [boardContainerElem]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start">
      <div
        ref={(elem) => setBoardContainerElem(elem)}
        className="w-full"
        style={{ position: "sticky", top: 0 }}
      >
        <div className="w-full max-w-[70vh] min-w-[248px] mx-auto bg-gray-800 rounded-[1vmin] shadow-lg p-2 border">
          <div
            className={`grid gap-0.5 md:gap-1 h-full w-full`}
            style={{
              gridTemplateColumns: `repeat(${
                maxY - minY + 1
              }, minmax(0px, 1fr))`,
            }}
          >
            {Array.from({ length: 15 * 15 }).map((_, index) => {
              const x = Math.floor(index / 15);
              const y = index % 15;
              const coordString = `${x},${y}`;
              if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                if (playedTilesCoords.has(coordString)) {
                  const tile = getTileFor(x, y);
                  // TODO: only set is revealed when user clicks check all
                  const isRevealed = false; // revealedCells.includes(coordString);
                  return (
                    <CrosswordTile
                      key={index}
                      id={`tile-${x}-${y}`}
                      tile={tile}
                      number={wordStartPositions[coordString]}
                      isRevealed={isRevealed}
                      value={userInputs[coordString] || ""}
                      onChange={(val) => handleInputChange(x, y, val)}
                      onFocus={() => setActiveCell({ x, y })}
                    />
                  );
                } else {
                  return (
                    <div key={index} className="aspect-square bg-gray-800" />
                  );
                }
              }
              return null;
            })}
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          <Button onClick={handleCheck}>
            <Check className="mr-2 h-4 w-4" />
            Check All
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div
        className="w-full pb-4"
        style={{
          backgroundColor: "hsl(var(--background))",
          boxShadow: "0px -12px 12px 12px hsl(var(--background))",
          position: "sticky",
          bottom: 0,
          marginTop: isMobile ? `${boardContainerHeight + 24}px` : 0,
        }}
      >
        <Tabs defaultValue="across">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="across">Across</TabsTrigger>
            <TabsTrigger value="down">Down</TabsTrigger>
          </TabsList>
          <TabsContent
            value="across"
            className="h-full w-full rounded-md border p-4 overflow-y-auto"
          >
            {renderClueList(acrossClues)}
          </TabsContent>
          <TabsContent
            value="down"
            className="h-full w-full rounded-md border p-4 overflow-y-auto"
          >
            {renderClueList(downClues)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
