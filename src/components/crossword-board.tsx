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
import { getWordDefinition, getWordDefinitions } from "@/app/actions";
import { Button } from "./ui/button";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  Check,
  RotateCcw,
  RefreshCw,
  Focus,
  MessageSquarePlus,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CrosswordGuessDialog } from "./crossword-guess-dialog";
import { ReportBugDialog } from "./ui/report-bug-dialog";

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
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [reloadingClues, setReloadingClues] = useState<string[]>([]);

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

  const [isReportBugOpen, setIsReportBugOpen] = useState(false);
  const [isGuessDialogOpen, setIsGuessDialogOpen] = useState(false);
  const [focusedWord, setFocusedWord] = useState<Word | null>(null);

  const isMobile = useIsMobile();
  const cluesContainerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  // dynamically calculate the height of the element with id board-container
  const [boardContainerElem, setBoardContainerElem] =
    useState<HTMLDivElement | null>(null);
  const [boardContainerHeight, setBoardContainerHeight] = useState(400);

  const { wordStartPositions, playedTilesCoords, wordsByCell } = useMemo(() => {
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
    const wordsByCell = new Map<string, { across?: number; down?: number }>();

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
            wordsByCell.set(cellKey, {
              ...existing,
              across: currentWordNumber,
            });
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
            wordsByCell.set(cellKey, {
              ...existing,
              down: currentWordNumber,
            });
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
      new Map(
        wordsList.map((w) => [`${w.word}-${w.x}-${w.y}-${w.direction}`, w])
      ).values()
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

  const allCellsFilled = useMemo(() => {
    const filledCellCount = Object.values(userInputs).filter((v) => v).length;
    return filledCellCount === playedTilesCoords.size;
  }, [userInputs, playedTilesCoords]);

  const scrollClueIntoView = useCallback(
    (wordNumber: number | null, direction: "across" | "down") => {
      if (!wordNumber || !cluesContainerRef.current) return;

      const clueElement = cluesContainerRef.current.querySelector(
        `#clue-${direction}-${wordNumber}`
      ) as HTMLElement;

      if (clueElement) {
        const container = cluesContainerRef.current;
        const scrollPosition =
          clueElement.offsetTop -
          container.offsetTop -
          container.clientHeight / 3;
        container.scrollTo({ top: scrollPosition, behavior: "smooth" });
      }
    },
    []
  );

  const handleTileClick = (x: number, y: number) => {
    const isSameCell = activeCell?.x === x && activeCell?.y === y;
    const wordNums = wordsByCell.get(`${x},${y}`);

    let newDirection = activeDirection;

    if (isSameCell) {
      // Toggle direction if clicking the same cell
      newDirection = activeDirection === "across" ? "down" : "across";
      // Only toggle if there's a word in that new direction
      if (
        !(
          (newDirection === "across" && wordNums?.across) ||
          (newDirection === "down" && wordNums?.down)
        )
      ) {
        newDirection = activeDirection; // Revert if no word in new direction
      }
    } else {
      // New cell selected
      setActiveCell({ x, y });

      // Prefer current direction if possible, otherwise switch to the available one.
      if (wordNums?.across && wordNums?.down) {
        // If both directions are available, default to across or stick to current if it's an option.
        newDirection =
          activeDirection === "down" && !wordNums.down
            ? "across"
            : activeDirection;
      } else if (wordNums?.across) {
        newDirection = "across";
      } else if (wordNums?.down) {
        newDirection = "down";
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
      const inputEl = tileRefs.current.get(cellKey);
      inputEl?.focus();
    } else {
      setActiveWords({ across: null, down: null });
    }
  }, [activeCell, wordsByCell, activeDirection]);

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
    // Track last played time
    localStorage.setItem(
      `crossword-${gameState.gameId}-lastPlayed`,
      Date.now().toString()
    );

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
          // The ref map key is a string 'x,y', but we need to find the ref for the next input element
          const nextInputRef = tileRefs.current.get(`${nextX},${nextY}`);
          if (nextInputRef) {
            nextInputRef.focus();
            // Also update the active cell to ensure highlighting follows
            setActiveCell({ x: nextX, y: nextY });
          }
        }
      }
    }
  };

  const handleClueClick = (word: Omit<Word, "clue">) => {
    setActiveCell({ x: word.x, y: word.y });
    setActiveDirection(word.direction);
    scrollClueIntoView(word.number, word.direction);
  };

  const handleFocusWord = (word: Omit<Word, "clue">) => {
    setFocusedWord({ ...word, clue: clues[word.word] || "" });
    setIsGuessDialogOpen(true);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    x: number,
    y: number
  ) => {
    let nextX = x;
    let nextY = y;
    let moved = false;

    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
      // Allow typing to overwrite
      handleInputChange(x, y, e.key);
      e.preventDefault();
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        if (activeDirection === "across") {
          setActiveDirection("down");
          return;
        }
        nextX = x - 1;
        moved = true;
        break;
      case "ArrowDown":
        if (activeDirection === "across") {
          setActiveDirection("down");
          return;
        }
        nextX = x + 1;
        moved = true;
        break;
      case "ArrowLeft":
        if (activeDirection === "down") {
          setActiveDirection("across");
          return;
        }
        nextY = y - 1;
        moved = true;
        break;
      case "ArrowRight":
        if (activeDirection === "down") {
          setActiveDirection("across");
          return;
        }
        nextY = y + 1;
        moved = true;
        break;
      case "Backspace":
        e.preventDefault();
        const currentKey = `${x},${y}`;
        if (userInputs[currentKey]) {
          setUserInputs((prev) => ({ ...prev, [currentKey]: "" }));
        } else {
          // Move to previous tile
          if (activeDirection === "across") {
            nextY = y - 1;
          } else {
            nextX = x - 1;
          }
          moved = true;
        }
        break;
      default:
        return; // Exit for other keys
    }

    if (moved) {
      e.preventDefault();
      const nextKey = `${nextX},${nextY}`;
      if (playedTilesCoords.has(nextKey)) {
        setActiveCell({ x: nextX, y: nextY });
      }
    }
  };

  const handleReset = () => {
    setRevealedCells([]);
    setUserInputs({});
    setActiveCell(null);
    setIsResetConfirmOpen(false);
  };

  const handleCheck = () => {
    const cellsToReveal: string[] = [];

    words.forEach((wordInfo) => {
      let isCompleteAndCorrect = true;
      const wordCells: { x: number; y: number }[] = [];

      for (let i = 0; i < wordInfo.length; i++) {
        const x = wordInfo.direction === "down" ? wordInfo.x + i : wordInfo.x;
        const y = wordInfo.direction === "across" ? wordInfo.y + i : wordInfo.y;
        wordCells.push({ x, y });

        const cellKey = `${x},${y}`;
        const userInput = userInputs[cellKey];
        const correctTile = getTileFor(x, y);

        if (
          !userInput ||
          !correctTile ||
          userInput.toUpperCase() !== correctTile.letter
        ) {
          isCompleteAndCorrect = false;
          break;
        }
      }

      if (isCompleteAndCorrect) {
        wordCells.forEach((cell) => cellsToReveal.push(`${cell.x},${cell.y}`));
      }
    });

    setRevealedCells((prev) => [...new Set([...prev, ...cellsToReveal])]);
  };

  const handleGuessSubmit = (guess: string) => {
    if (!focusedWord) return;

    const newInputs = { ...userInputs };
    for (let i = 0; i < focusedWord.length; i++) {
      const x =
        focusedWord.direction === "down" ? focusedWord.x + i : focusedWord.x;
      const y =
        focusedWord.direction === "across" ? focusedWord.y + i : focusedWord.y;
      const key = `${x},${y}`;
      if (guess[i]) {
        // only update if a guess was entered for that letter
        newInputs[key] = guess[i].toUpperCase();
      }
    }
    setUserInputs(newInputs);
    // Track last played time
    localStorage.setItem(
      `crossword-${gameState.gameId}-lastPlayed`,
      Date.now().toString()
    );
  };

  const handleRefreshClue = async (word: string) => {
    setReloadingClues((prev) => [...prev, word]);
    try {
      const newDefinition = await getWordDefinition(word, true);
      if (newDefinition) {
        setClues((prev) => ({ ...prev, [word]: newDefinition }));
      }
    } catch (error) {
      console.error("Failed to refresh clue", error);
    } finally {
      setReloadingClues((prev) => prev.filter((w) => w !== word));
    }
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
      const isReloading = reloadingClues.includes(word.word);

      let isComplete = true;
      const wordCells: { x: number; y: number }[] = [];

      for (let i = 0; i < word.length; i++) {
        const x = word.direction === "down" ? word.x + i : word.x;
        const y = word.direction === "across" ? word.y + i : word.y;
        wordCells.push({ x, y });

        const cellKey = `${x},${y}`;
        const userInput = userInputs[cellKey];
        const correctTile = getTileFor(x, y);

        if (!userInput || !correctTile) {
          isComplete = false;
          break;
        }
      }

      const isRevealed = revealedCells.some(
        (cell) => cell === `${word.x},${word.y}`
      );

      return (
        <div
          key={word.number + word.direction}
          id={`clue-${direction}-${word.number}`}
          onClick={() => handleClueClick(word)}
          className={cn(
            "text-sm mb-2 flex items-start text-left p-2 rounded-md transition-colors cursor-pointer",
            isActive ? "bg-primary/10 text-primary" : ""
          )}
          style={{
            textDecoration: isRevealed ? "line-through" : "none",
            opacity: isComplete ? 0.5 : 1,
          }}
        >
          <span className="font-bold w-8">{word.number}.</span>
          <span className="flex-1">
            {isReloading ? (
              <span className="text-muted-foreground italic">Fetching...</span>
            ) : (
              clues[word.word] || (
                <span className="text-muted-foreground italic">
                  Fetching...
                </span>
              )
            )}{" "}
            <span className="text-muted-foreground">
              ({word.length} {word.length === 1 ? "letter" : "letters"})
            </span>
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 ml-2"
            disabled={isReloading}
            onClick={(e) => {
              e.stopPropagation();
              handleRefreshClue(word.word);
            }}
          >
            <RefreshCw
              className={cn("h-4 w-4", isReloading && "animate-spin")}
            />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation(); // Prevent parent div's onClick
              handleFocusWord(word);
            }}
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

                  let isActive = false;
                  if (activeCell && activeCell.x === x && activeCell.y === y) {
                    isActive = true;
                  } else {
                    const activeWordInfo = words.find(
                      (w) =>
                        w.number === activeWords[activeDirection] &&
                        w.direction === activeDirection
                    );
                    if (activeWordInfo) {
                      if (activeDirection === "across") {
                        isActive =
                          x === activeWordInfo.x &&
                          y >= activeWordInfo.y &&
                          y < activeWordInfo.y + activeWordInfo.length;
                      } else {
                        isActive =
                          y === activeWordInfo.y &&
                          x >= activeWordInfo.x &&
                          x < activeWordInfo.x + activeWordInfo.length;
                      }
                    }
                  }

                  return (
                    <CrosswordTile
                      key={coordString}
                      id={`tile-${x}-${y}`}
                      ref={(el) => void tileRefs.current.set(coordString, el)}
                      tile={tile}
                      number={wordStartPositions[coordString]}
                      isRevealed={isRevealed}
                      value={userInputs[coordString] || ""}
                      onChange={(val) => handleInputChange(x, y, val)}
                      onKeyDown={(e) => handleKeyDown(e, x, y)}
                      onClick={() => handleTileClick(x, y)}
                      isActive={isActive}
                      isPartiallyActive={
                        activeCell?.x === x && activeCell?.y === y
                      }
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
          {/* TODO: maybe replace with alert dialog in future versions */}
          <ReportBugDialog
            isReportBugOpen={isReportBugOpen}
            setIsReportBugOpen={setIsReportBugOpen}
            gameId={gameState.gameId}
            sha={"crossword"}
          />
          <Button
            variant="outline"
            onClick={() => setIsReportBugOpen(true)}
            title="Report Bug"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button onClick={handleCheck} disabled={!allCellsFilled}>
            <Check className="mr-2 h-4 w-4" />
            Check All
          </Button>
          <AlertDialog
            open={isResetConfirmOpen}
            onOpenChange={setIsResetConfirmOpen}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all your progress on this puzzle. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div
        className="w-full z-10"
        style={{
          backgroundColor: "hsl(var(--background))",
          boxShadow: "0px -12px 12px 12px hsl(var(--background))",
          marginTop: "12px",
        }}
      >
        <div
          ref={cluesContainerRef}
          className={`h-full w-full rounded-md border overflow-y-auto`}
          style={{
            minHeight: "137px",
            maxHeight: isMobile
              ? `${Math.floor(
                  window.innerHeight - boardContainerHeight - 140
                )}px`
              : "80vh",
          }}
        >
          {isLoadingClues && Object.keys(clues).length === 0 ? (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading
              clues...
            </div>
          ) : (
            <div className="p-2">
              <h3 className="font-bold text-sm mb-2 sticky top-0 py-2 border-b bg-background z-10">
                Across
              </h3>
              {renderClueList(acrossClues, "across")}
              <h3 className="font-bold text-sm mt-4 mb-2 sticky top-0 py-2 border-b bg-background z-10">
                Down
              </h3>
              {renderClueList(downClues, "down")}
            </div>
          )}
        </div>
      </div>
      <CrosswordGuessDialog
        isOpen={isGuessDialogOpen}
        onOpenChange={setIsGuessDialogOpen}
        wordInfo={focusedWord}
        userInputs={userInputs}
        onGuess={handleGuessSubmit}
        revealedCells={revealedCells}
      />
    </div>
  );
}
