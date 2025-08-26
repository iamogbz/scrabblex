
"use client";

import type { GameState, PlacedTile } from "@/types";
import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import CrosswordTile from "./crossword-tile";
import { getWordDefinitions } from "@/app/actions";
import { Button } from "./ui/button";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Check, RotateCcw, RefreshCw, Focus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const [activeWords, setActiveWords] = useState<{
    across: number | null;
    down: number | null;
  }>({ across: null, down: null });
  const [activeDirection, setActiveDirection] = useState<"across" | "down">(
    "across"
  );
  
  const isMobile = useIsMobile();
  const cluesContainerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // dynamically calculate the height of the element with id board-container
  const [boardContainerElem, setBoardContainerElem] =
    useState<HTMLDivElement | null>(null);
  const [boardContainerHeight, setBoardContainerHeight] = useState(400);

  const { board, wordStartPositions, playedTilesCoords, wordsByCell } =
    useMemo(() => {
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
      const wordsByCell = new Map<
        string,
        { across?: number; down?: number }
      >();

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
            const currentWordNumber = wordStartPositions[`${r},${c}`];
            for (let i = c; i < 15 && board[r][i]; i++) {
              word += board[r][i]!.letter;
              length++;
              const cellKey = `${r},${i}`;
              const existing = wordsByCell.get(cellKey) || {};
              wordsByCell.set(cellKey, { ...existing, across: currentWordNumber });
            }
            if (length > 1) {
              wordsList.push({
                number: currentWordNumber,
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
            const currentWordNumber = wordStartPositions[`${r},${c}`];
            for (let i = r; i < 15 && board[i]?.[c]; i++) {
              word += board[i][c]!.letter;
              length++;
              const cellKey = `${i},${c}`;
              const existing = wordsByCell.get(cellKey) || {};
              wordsByCell.set(cellKey, { ...existing, down: currentWordNumber });
            }
            if (length > 1) {
              wordsList.push({
                number: currentWordNumber,
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

      return {
        board,
        wordStartPositions,
        playedTilesCoords: coords,
        wordsByCell,
      };
    }, [gameState.history]);
  
  const scrollClueIntoView = useCallback((wordNumber: number | null, direction: 'across' | 'down') => {
    if (!wordNumber || !cluesContainerRef.current) return;

    const clueElement = cluesContainerRef.current.querySelector(`#clue-${direction}-${wordNumber}`) as HTMLElement;
    
    if (clueElement) {
      const container = cluesContainerRef.current;
      const scrollPosition = clueElement.offsetTop - container.offsetTop - (container.clientHeight / 3);
      container.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    }
  }, []);

  const handleTileClick = (x: number, y: number) => {
    const isSameCell = activeCell?.x === x && activeCell?.y === y;
    const wordNums = wordsByCell.get(`${x},${y}`);

    let newDirection = activeDirection;

    if (isSameCell) {
      // Toggle direction if clicking the same cell
      newDirection = activeDirection === 'across' ? 'down' : 'across';
      // Only toggle if there's a word in that new direction
      if (!((newDirection === 'across' && wordNums?.across) || (newDirection === 'down' && wordNums?.down))) {
        newDirection = activeDirection; // Revert if no word in new direction
      }
    } else {
      // New cell selected
      setActiveCell({ x, y });
      
      // Prefer current direction if possible, otherwise switch to the available one.
      if (!((activeDirection === 'across' && wordNums?.across) || (activeDirection === 'down' && wordNums?.down))) {
        newDirection = (wordNums?.across) ? 'across' : 'down';
      }
    }
    
    setActiveDirection(newDirection);
    scrollClueIntoView(wordNums?.[newDirection] || null, newDirection);
  };


  useEffect(() => {
    if (activeCell) {
      const cellKey = `${activeCell.x},${activeCell.y}`;
      const wordNums = wordsByCell.get(cellKey);
      setActiveWords({
        across: wordNums?.across || null,
        down: wordNums?.down || null,
      });
    } else {
      setActiveWords({ across: null, down: null });
    }
  }, [activeCell, wordsByCell]);

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

    if (value) {
      const activeWordNumber = activeWords[activeDirection];
      const activeWordInfo = words.find(
        (w) => w.number === activeWordNumber && w.direction === activeDirection
      );

      if (activeWordInfo) {
        let currentPosInWord = -1;
        if (activeDirection === "across") {
          currentPosInWord = y - activeWordInfo.y;
        } else {
          currentPosInWord = x - activeWordInfo.x;
        }

        if (currentPosInWord < activeWordInfo.length - 1) {
          let nextX = x;
          let nextY = y;
          if (activeDirection === "across") {
            nextY += 1;
          } else {
            nextX += 1;
          }
          const nextTile = tileRefs.current.get(`${nextX},${nextY}`);
          nextTile?.click();
          handleTileClick(nextX, nextY);
        }
      }
    }
  };

  const handleFocusWord = (word: Omit<Word, "clue">) => {
    const tileElement = tileRefs.current.get(`${word.x},${word.y}`);
    if (tileElement) {
      window.scrollTo({
        top: tileElement.offsetTop - window.innerHeight / 2, // Center in viewport
        behavior: "smooth",
      });
      tileElement.click();
      handleTileClick(word.x, word.y);
    }
  };

  const handleReset = () => {
    setRevealedCells([]);
    setUserInputs({});
    setActiveCell(null);
  };

  const handleCheck = () => {
    const cellsToReveal: string[] = [];
  
    words.forEach(wordInfo => {
      let isCompleteAndCorrect = true;
      const wordCells: {x: number, y: number}[] = [];
  
      for (let i = 0; i < wordInfo.length; i++) {
        const x = wordInfo.direction === 'down' ? wordInfo.x + i : wordInfo.x;
        const y = wordInfo.direction === 'across' ? wordInfo.y + i : wordInfo.y;
        wordCells.push({ x, y });
  
        const cellKey = `${x},${y}`;
        const userInput = userInputs[cellKey];
        const correctTile = getTileFor(x, y);
  
        if (!userInput || !correctTile || userInput.toUpperCase() !== correctTile.letter) {
          isCompleteAndCorrect = false;
          break;
        }
      }
  
      if (isCompleteAndCorrect) {
        wordCells.forEach(cell => cellsToReveal.push(`${cell.x},${cell.y}`));
      }
    });
  
    setRevealedCells(prev => [...new Set([...prev, ...cellsToReveal])]);
  };

  const acrossClues = words.filter((w) => w.direction === "across");
  const downClues = words.filter((w) => w.direction === "down");

  const renderClueList = (
    wordList: Omit<Word, "clue">[],
    direction: "across" | "down"
  ) => {
    return wordList.map((word) => {
      const isActive =
        (direction === "across" && activeWords.across === word.number) ||
        (direction === "down" && activeWords.down === word.number);

      return (
        <div
          key={word.number + word.direction}
          id={`clue-${direction}-${word.number}`}
          className={cn(
            "text-sm mb-2 flex items-start text-left p-2 rounded-md transition-colors",
            isActive ? "bg-primary/10 text-primary" : ""
          )}
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
      );
    });
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
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
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
            {Array.from({ length: (maxX - minX + 1) * (maxY - minY + 1) }).map(
              (_, index) => {
                const colCount = maxY - minY + 1;
                const x = minX + Math.floor(index / colCount);
                const y = minY + (index % colCount);
                const coordString = `${x},${y}`;

                if (playedTilesCoords.has(coordString)) {
                  const tile = getTileFor(x, y);
                  const isRevealed = revealedCells.includes(coordString);
                  const cellWords = wordsByCell.get(coordString);
                  const isActive =
                    (activeDirection === "across" &&
                      cellWords?.across === activeWords.across) ||
                    (activeDirection === "down" &&
                      cellWords?.down === activeWords.down);

                  return (
                    <CrosswordTile
                      key={coordString}
                      id={`tile-${x}-${y}`}
                      ref={(el) => void tileRefs.current.set(`${x},${y}`, el)}
                      tile={tile}
                      number={wordStartPositions[coordString]}
                      isRevealed={isRevealed}
                      value={userInputs[coordString] || ""}
                      onChange={(val) => handleInputChange(x, y, val)}
                      onClick={() => handleTileClick(x, y)}
                      isActive={isActive}
                      isPartiallyActive={activeCell?.x === x && activeCell?.y === y}
                    />
                  );
                } else {
                  return (
                    <div
                      key={coordString}
                      className="aspect-square bg-gray-800"
                    />
                  );
                }
              }
            )}
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
        <div 
          ref={cluesContainerRef}
          className="h-full w-full rounded-md border overflow-y-auto max-h-[80vh] md:max-h-[calc(100vh-2rem)]"
        >
          {isLoadingClues && Object.keys(clues).length === 0 ? (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading clues...
            </div>
          ) : (
            <>
              <h3 className="font-bold text-lg mb-2 sticky top-0 bg-background py-2 border-b">Across</h3>
              {renderClueList(acrossClues, "across")}
              <h3 className="font-bold text-lg mt-4 mb-2 sticky top-0 bg-background py-2 border-b">Down</h3>
              {renderClueList(downClues, "down")}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

    