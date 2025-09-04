

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LocalStorageKey, PLAYER_COLORS } from "@/lib/constants";
import type {
  GameState,
  Player,
  Tile,
  PlacedTile,
  PlayedWord,
  BoardSquare,
} from "@/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  UserPlus,
  Copy,
  Check,
  Users,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  EyeOff,
  Eye,
  LifeBuoy,
  GitPullRequestCreate,
  MessageSquarePlus,
  PencilRuler,
  HelpingHand,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./game-board";
import PlayerRack from "./player-rack";
import Scoreboard from "./scoreboard";
import {
  getGameState,
  getWordSuggestions,
  replacePlayerWithComputer,
  suggestWordAction,
  verifyWordAction,
  playTurn,
  addPlayer,
} from "@/app/actions";
import Link from "next/link";
import { PlayerAuthDialog } from "./player-auth-dialog";
import WordBuilder from "./word-builder";
import { calculateMoveScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import SingleTile from "./tile";
import { BlankTileDialog } from "./blank-tile-dialog";
import { ReportBugDialog } from "./ui/report-bug-dialog";
import { createInitialBoard } from "@/lib/game-data";
import { HistoryDialog } from "./history-dialog";
import { updateGame } from "@/lib/game-service";
import { useLocalStorage } from "@/hooks/use-local-storage";

const MAX_PLAYER_COUNT = 4;

export default function GameClient({
  gameId,
  setLeaveGameHandler,
}: {
  gameId: string;
  setLeaveGameHandler: (handler: () => void) => void;
}) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerCode, setNewPlayerCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const [stagedTiles, setStagedTiles] = useLocalStorage<
    Record<number, PlacedTile>
  >(`scrabblex_staged_tiles_${gameId}`, {});

  const [selectedBuilderIndex, setSelectedBuilderIndex] = useState<
    number | null
  >(null);
  const [selectedRackTileIndex, setSelectedRackTileIndex] = useState<
    number | null
  >(null);
  const [selectedBoardPos, setSelectedBoardPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [playDirection, setPlayDirection] = useState<
    "horizontal" | "vertical" | null
  >(null);
  const [isSwapConfirmOpen, setIsSwapConfirmOpen] = useState(false);
  const [isSuggestWordOpen, setIsSuggestWordOpen] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [isReportBugOpen, setIsReportBugOpen] = useState(false);
  const [isTileBagOpen, setIsTileBagOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResignConfirmOpen, setIsResignConfirmOpen] = useState(false);
  const [isBlankTileDialogOpen, setIsBlankTileDialogOpen] = useState(false);
  const [blankTileToStage, setBlankTileToStage] = useState<Tile | null>(null);
  const [stagedTileToReassign, setStagedTileToReassign] = useState<
    number | null
  >(null);

  const [authenticatedPlayerId, setAuthenticatedPlayerId] = useState<
    string | null
  >(null);

  const authenticatedPlayerIndex = gameState?.players?.findIndex(
    (p) => p.id === authenticatedPlayerId
  );
  const playerColor =
    authenticatedPlayerIndex !== undefined && authenticatedPlayerIndex !== -1
      ? PLAYER_COLORS[authenticatedPlayerIndex % PLAYER_COLORS.length]
      : undefined;

  const lastMoveTimestampRef = useRef<string | null>(null);

  const { toast } = useToast();

  const fetchGame = useCallback(
    async (isPoll = false) => {
      if (!isPoll) setIsLoading(true);
      else setIsPolling(true);
      setError(null);
      try {
        const gameData = await getGameState(gameId);
        if (gameData) {
          if (gameData.sha !== sha) {
            setGameState(gameData.gameState);
            setSha(gameData.sha);
          }
        } else {
          setError(
            `Game with ID "${gameId}" not found. Check the key or create a new game.`
          );
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load game data. Please try again.");
      } finally {
        if (!isPoll) setIsLoading(false);
        else setIsPolling(false);
      }
    },
    [gameId, sha]
  );

  const turnsPlayed = useMemo(
    () => gameState?.history?.filter(h => h.playerId).length ?? 0,
    [gameState]
  );

  const currentPlayer = useMemo(() => {
    if (!gameState || gameState.players.length === 0) return null;

    if (turnsPlayed < gameState.players.length) {
      const playedPlayerIds = new Set(gameState.history.map((h) => h.playerId));
      const waitingPlayers = gameState.players.filter(
        (p) => !playedPlayerIds.has(p.id)
      );
      if (waitingPlayers.length > 0) {
        return waitingPlayers[0];
      }
    }

    const playerIndex = turnsPlayed % gameState.players.length;
    return gameState.players[playerIndex];
  }, [gameState, turnsPlayed]);

  useEffect(() => {
    fetchGame();
    const intervalId = setInterval(() => fetchGame(true), 5000);
    return () => clearInterval(intervalId);
  }, [fetchGame]);

  const resetTurn = useCallback(() => {
    setStagedTiles({});
    setSelectedBoardPos(null);
    setPlayDirection(null);
    setSelectedBuilderIndex(null);
    setSelectedRackTileIndex(null);
  }, [setStagedTiles]);

  const handleLeaveGame = useCallback(() => {
    resetTurn();
    localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
    setAuthenticatedPlayerId(null);
    toast({
      title: "Left Game",
      description: "You have returned to the lobby.",
    });
  }, [gameId, toast, resetTurn]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (
      !gameState ||
      !authenticatedPlayerId ||
      gameState.gamePhase === "ended" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const lastMove =
      gameState.history.length > 0
        ? gameState.history[gameState.history.length - 1]
        : null;

    if (
      lastMove &&
      lastMove.timestamp !== lastMoveTimestampRef.current &&
      lastMove.playerId !== authenticatedPlayerId
    ) {
      lastMoveTimestampRef.current = lastMove.timestamp;

      if ("Notification" in window && Notification.permission === "granted") {
        let notificationBody = "";
        if (lastMove.isPass) {
          notificationBody = `${lastMove.playerName} passed their turn.`;
        } else if (lastMove.isSwap) {
          notificationBody = `${lastMove.playerName} swapped tiles.`;
        } else if (lastMove.isResign) {
          notificationBody = `${lastMove.playerName} has resigned.`;
        } else {
          notificationBody = `${lastMove.playerName} played "${lastMove.word}" for ${lastMove.score} points.`;
        }

        const title = "Scrabblex Move";
        const options = {
          body: notificationBody,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          vibrate: [100, 50, 100],
        };

        if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
          });
        } else {
          new Notification(title, options);
        }
      }
    } else if (!lastMove) {
      lastMoveTimestampRef.current = null;
    }
  }, [gameState, authenticatedPlayerId]);

  useEffect(() => {
    const gameHistory = new Set(
      JSON.parse(localStorage.getItem(LocalStorageKey.GAMES) || "[]")
    );
    if (!gameHistory.has(gameId)) {
      gameHistory.add(gameId);
      localStorage.setItem(
        LocalStorageKey.GAMES,
        JSON.stringify(Array.from(gameHistory).sort())
      );
    }
    const storedPlayerId = localStorage.getItem(
      `${LocalStorageKey.PLAYER_ID_}${gameId}`
    );
    if (storedPlayerId) {
      setAuthenticatedPlayerId(storedPlayerId);
    }
    setLeaveGameHandler(() => handleLeaveGame);
  }, [gameId, setLeaveGameHandler, handleLeaveGame]);

  useEffect(() => {
    if (gameState && authenticatedPlayerId) {
      if (!gameState.players.some((p) => p.id === authenticatedPlayerId)) {
        setAuthenticatedPlayerId(null);
        localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
      }
    }
  }, [gameState, authenticatedPlayerId, gameId]);

  const authenticatedPlayer = useMemo(() => {
    if (!gameState || !authenticatedPlayerId) return null;
    return (
      gameState.players.find((p) => p.id === authenticatedPlayerId) ?? null
    );
  }, [gameState, authenticatedPlayerId]);

  useEffect(() => {
    if (authenticatedPlayer && Object.keys(stagedTiles).length > 0) {
      const rackLetters = [...authenticatedPlayer.rack];
      const validStagedTiles: Record<number, PlacedTile> = {};
      let somethingChanged = false;

      Object.entries(stagedTiles).forEach(([key, stagedTile]) => {
        const letterToCheck = stagedTile.originalLetter ?? stagedTile.letter;
        const indexInRack = rackLetters.findIndex(
          (t) => t.letter === letterToCheck
        );

        if (indexInRack !== -1) {
          validStagedTiles[parseInt(key)] = stagedTile;
          // Remove the tile from the available rack letters to handle duplicates
          rackLetters.splice(indexInRack, 1);
        } else {
          somethingChanged = true;
        }
      });

      if (somethingChanged) {
        setStagedTiles(validStagedTiles);
      }
    }
  }, [authenticatedPlayer, stagedTiles, setStagedTiles]);


  const existingPlayer = useMemo(() => {
    if (!gameState || !newPlayerName) return null;
    return gameState.players.find(
      (p) => p.name.toLowerCase() === newPlayerName.trim().toLowerCase()
    );
  }, [gameState, newPlayerName]);

  const numPlayers = gameState?.players.length || 0;
  const lobbyFull = numPlayers >= MAX_PLAYER_COUNT;
  const currentTurnsPlayed = gameState?.history.length || 0;
  const currentRoundsPlayed =
    numPlayers && Math.floor(currentTurnsPlayed / numPlayers);
  const gameStarted =
    (numPlayers > 1 && currentRoundsPlayed > 0) ||
    (numPlayers < 2 && currentTurnsPlayed > 1);

  const canJoinGame = useMemo(() => {
    if (!gameState) return false;
    if (existingPlayer) {
      return true;
    }
    if (gameStarted || lobbyFull) {
      return false;
    }
    return true;
  }, [gameState, existingPlayer, gameStarted, lobbyFull]);

  const isMyTurn = useMemo(() => {
    return authenticatedPlayerId === currentPlayer?.id;
  }, [authenticatedPlayerId, currentPlayer]);

  const rackTiles = useMemo(() => {
    if (!authenticatedPlayer) return [];
    const stagedTileValues = Object.values(stagedTiles);
    const stagedLettersCopy = stagedTileValues.map(
      (t) => t.originalLetter ?? t.letter
    );
    const rackCopy = [...authenticatedPlayer.rack];
    const availableTiles = rackCopy.filter((rackTile) => {
      const index = stagedLettersCopy.indexOf(rackTile.letter);
      if (index > -1) {
        stagedLettersCopy.splice(index, 1);
        return false;
      }
      return true;
    });
    return availableTiles;
  }, [authenticatedPlayer, stagedTiles]);

  const wordBuilderSlots = useMemo((): readonly BoardSquare[] => {
    const MAX_EMPTY_SLOTS = 7;
    const defaultEmptySlots = Object.freeze(
      Array<BoardSquare>(MAX_EMPTY_SLOTS).fill({
        tile: null,
        x: -1,
        y: -1,
        isCenter: false,
        multiplier: 0,
        multiplierType: null,
      })
    );
    if (!selectedBoardPos || !playDirection || !gameState)
      return defaultEmptySlots;
    const slots: BoardSquare[] = [];
    let { x: currentX, y: currentY } = selectedBoardPos;
    if (playDirection === "horizontal") {
      while (currentY > 0 && gameState.board[currentX][currentY - 1].tile) {
        currentY--;
      }
    } else {
      while (currentX > 0 && gameState.board[currentX - 1][currentY].tile) {
        currentX--;
      }
    }
    let emptySlotsCount = 0;
    while (
      ((playDirection === "horizontal" && currentY < 15) ||
        (playDirection === "vertical" && currentX < 15)) &&
      emptySlotsCount < MAX_EMPTY_SLOTS
    ) {
      const boardSquare = gameState.board[currentX][currentY];
      slots.push(boardSquare);
      if (!boardSquare.tile) {
        emptySlotsCount++;
      }

      if (playDirection === "horizontal") currentY++;
      else currentX++;
    }
    return slots;
  }, [selectedBoardPos, playDirection, gameState]);

  const tempPlacedTiles = useMemo((): PlacedTile[] => {
    if (
      !selectedBoardPos ||
      !playDirection ||
      !wordBuilderSlots.length ||
      Object.keys(stagedTiles).length === 0
    ) {
      return [];
    }

    const placed: PlacedTile[] = [];
    let { x: startX, y: startY } = selectedBoardPos;

    // Find the actual start of the word on the board
    if (playDirection === "horizontal") {
      while (startY > 0 && gameState?.board[startX][startY - 1].tile) {
        startY--;
      }
    } else {
      while (startX > 0 && gameState?.board[startX - 1][startY].tile) {
        startX--;
      }
    }

    let emptySlotCounter = 0;
    for (let i = 0; i < wordBuilderSlots.length; i++) {
      const currentX = playDirection === "vertical" ? startX + i : startX;
      const currentY = playDirection === "horizontal" ? startY + i : startY;

      if (currentX >= 15 || currentY >= 15) break;

      const boardSquare = wordBuilderSlots[i];

      if (!boardSquare.tile) {
        const stagedTileForThisSlot = stagedTiles[emptySlotCounter];
        if (stagedTileForThisSlot) {
          placed.push({ ...stagedTileForThisSlot, x: currentX, y: currentY });
        }
        emptySlotCounter++;
      }
    }
    return placed;
  }, [
    stagedTiles,
    wordBuilderSlots,
    playDirection,
    selectedBoardPos,
    gameState,
  ]);

  const tileBagContents = useMemo(() => {
    if (!gameState?.tileBag) return [];

    const counts: Record<string, { tile: Tile; count: number }> = {};

    for (const tile of gameState.tileBag) {
      const key = tile.letter || "BLANK";
      if (!counts[key]) {
        const displayTile = tile.letter ? tile : { letter: "", points: 0 };
        counts[key] = { tile: displayTile, count: 0 };
      }
      counts[key].count++;
    }

    return Object.values(counts).sort((a, b) => {
      if (a.tile.letter === "") return 1;
      if (b.tile.letter === "") return -1;
      return a.tile.letter.localeCompare(b.tile.letter);
    });
  }, [gameState?.tileBag]);

  const handleSuggestWord = async () => {
    if (!newWord.trim()) return;
    setIsSubmittingSuggestion(true);
    try {
      const result = await suggestWordAction(
        newWord.trim(),
        authenticatedPlayer?.name || "Anonymous",
        gameId
      );
      if (result.success && result.prUrl) {
        toast({
          title: "Suggestion Submitted!",
          description: (
            <>
              Pull request created:{" "}
              <a
                href={result.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                #{result.prNumber}
              </a>
            </>
          ),
        });
        setIsSuggestWordOpen(false);
        setNewWord("");
      } else {
        throw new Error(result.error || "An unknown error occurred.");
      }
    } catch (e: any) {
      toast({
        title: "Submission Failed",
        description: e.message || "Could not submit word suggestion.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const handleGenericAction = async (
    move: Parameters<typeof playTurn>[0]["move"]
  ) => {
    if (!authenticatedPlayer) return;
    setIsLoading(true);

    const result = await playTurn({
      gameId,
      player: authenticatedPlayer,
      move,
    });

    if (!result.success) {
      toast({
        title: "Action Failed",
        description:
          result.error ||
          "Could not perform the action. The game state may have changed.",
        variant: "destructive",
      });
    }
    await fetchGame();
    setIsLoading(false);
  };

  const joinGame = async () => {
    if (!newPlayerName.trim() || !newPlayerCode.trim()) {
      toast({
        title: "Cannot Join Game",
        description: "Player name and code cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    const trimmedName = newPlayerName.trim();
    const trimmedCode = newPlayerCode.trim();

    setIsLoading(true);

    if (existingPlayer) {
      if (existingPlayer.code === trimmedCode) {
        handleAuth(existingPlayer.id);
        toast({
          title: "Welcome back!",
          description: `You have rejoined the game as ${existingPlayer.name}.`,
        });
      } else {
        toast({
          title: "Cannot Join",
          description:
            "A player with that name already exists, but the code is incorrect.",
          variant: "destructive",
        });
      }
      setIsLoading(false);
      return;
    }

    try {
      const result = await addPlayer(gameId, trimmedName, trimmedCode);

      if (result.success && result.player) {
        handleAuth(result.player.id);
        toast({
          title: `Welcome, ${result.player.name}!`,
          description: "You have successfully joined the game.",
        });
        setNewPlayerName("");
        setNewPlayerCode("");
      } else {
        toast({
          title: "Failed to Join",
          description: result.error || "An unknown error occurred.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description:
          e.message || "A server error occurred while trying to join.",
        variant: "destructive",
      });
    } finally {
      await fetchGame();
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSquareClick = (x: number, y: number) => {
    setSelectedBoardPos((prevPos) => {
      // If clicking a different square, reset direction
      if (prevPos?.x !== x || prevPos?.y !== y) {
        setPlayDirection("horizontal");
        return { x, y };
      }
  
      // If clicking the same square, cycle through directions
      if (playDirection === "horizontal") {
        setPlayDirection("vertical");
        return prevPos; // Keep the same position
      }
  
      if (playDirection === "vertical") {
        // This is the third click on the same square, so deselect it
        setPlayDirection(null);
        return null;
      }
  
      // This case handles when a square is selected but direction is null (after deselection)
      // It will restart the cycle by setting direction to horizontal
      setPlayDirection("horizontal");
      return prevPos;
    });
  };

  const handleRackClick = () => {
    // If a builder tile is selected, clicking the rack should return it.
    if (selectedBuilderIndex !== null) {
      const newStagedTiles = { ...stagedTiles };
      delete newStagedTiles[selectedBuilderIndex];
      // Note: We are not re-keying/re-numbering the staged tiles.
      // This preserves spaces between them.
      setStagedTiles(newStagedTiles);
      setSelectedBuilderIndex(null);
    }
  };

  const handleRackTileClick = (tile: Tile, index: number) => {
    if (selectedBuilderIndex !== null) {
      // A builder slot is selected, place this tile there
      if (tile.letter === " ") {
        setBlankTileToStage(tile);
        setIsBlankTileDialogOpen(true);
      } else {
        const newStagedTiles = { ...stagedTiles };
        newStagedTiles[selectedBuilderIndex] = { ...tile, x: -1, y: -1 };
        setStagedTiles(newStagedTiles);
      }
      setSelectedBuilderIndex(null);
      setSelectedRackTileIndex(null);
    } else {
      // Otherwise, just select/deselect this rack tile
      setSelectedRackTileIndex(index === selectedRackTileIndex ? null : index);
    }
  };

  const handleStagedTileClick = (index: number) => {
    if (selectedRackTileIndex !== null && authenticatedPlayer) {
      // A rack tile is selected, perform a swap with the builder tile
      const rackTileToPlace = authenticatedPlayer.rack[selectedRackTileIndex];
      if (rackTileToPlace) {
        const newStagedTiles = { ...stagedTiles };
        newStagedTiles[index] = { ...rackTileToPlace, x: -1, y: -1 };
        setStagedTiles(newStagedTiles);
      }
      setSelectedRackTileIndex(null); // Deselect rack tile after swap
      return; // End the function here
    }

    if (stagedTiles[index]?.originalLetter === " ") {
      setStagedTileToReassign(index);
      setIsBlankTileDialogOpen(true);
      return;
    }

    if (selectedBuilderIndex === index) {
      // Deselect if clicking the same selected tile
      setSelectedBuilderIndex(null);
    } else if (selectedBuilderIndex !== null) {
      // Another staged tile is already selected, so swap them
      const newStagedTiles = { ...stagedTiles };
      const tileToMove = stagedTiles[selectedBuilderIndex];
      const targetTile = stagedTiles[index];
      if (tileToMove) {
        newStagedTiles[index] = tileToMove;
        if (targetTile) {
          newStagedTiles[selectedBuilderIndex] = targetTile;
        } else {
          delete newStagedTiles[selectedBuilderIndex];
        }
      }
      setStagedTiles(newStagedTiles);
      setSelectedBuilderIndex(null);
    } else {
      // Select the tile to be moved
      setSelectedBuilderIndex(index);
      setSelectedRackTileIndex(null); // Deselect any rack tile
    }
  };

  const handleBuilderSlotClick = (index: number) => {
    const newStagedTiles = { ...stagedTiles };

    if (selectedRackTileIndex !== null && authenticatedPlayer) {
      // A tile from the rack is selected, place it here
      const tileToPlace = authenticatedPlayer.rack[selectedRackTileIndex];
      if (tileToPlace) {
        if (tileToPlace.letter === " ") {
          setBlankTileToStage(tileToPlace);
          setSelectedBuilderIndex(index); // Set target for blank tile
          setIsBlankTileDialogOpen(true);
        } else {
          newStagedTiles[index] = { ...tileToPlace, x: -1, y: -1 };
          setStagedTiles(newStagedTiles);
        }
      }
      setSelectedRackTileIndex(null);
    } else if (selectedBuilderIndex !== null) {
      // A tile from the builder is selected, move it to this empty slot
      const tileToMove = newStagedTiles[selectedBuilderIndex];
      if (tileToMove) {
        delete newStagedTiles[selectedBuilderIndex]; // Remove from old position
        newStagedTiles[index] = tileToMove; // Add to new position
        setStagedTiles(newStagedTiles);
      }
      setSelectedBuilderIndex(null); // Deselect after move
    } else {
      // No tile is selected, so select this empty slot as the target
      setSelectedBuilderIndex(index);
    }
  };

  const handleBlankTileSelect = (letter: string) => {
    const newTileBase = blankTileToStage ||
      (stagedTileToReassign !== null &&
        stagedTiles[stagedTileToReassign]) || { letter: " ", points: 0 };

    const newTile: PlacedTile = {
      ...newTileBase,
      letter: letter,
      originalLetter: " ",
      x: -1,
      y: -1,
    };

    if (stagedTileToReassign !== null) {
      const newStagedTiles = { ...stagedTiles };
      newStagedTiles[stagedTileToReassign] = newTile;
      setStagedTiles(newStagedTiles);
      setStagedTileToReassign(null);
    } else if (selectedBuilderIndex !== null) {
      const newStagedTiles = { ...stagedTiles };
      newStagedTiles[selectedBuilderIndex] = newTile;
      setStagedTiles(newStagedTiles);
      setBlankTileToStage(null);
      setSelectedBuilderIndex(null);
    }
  };

  const handleReturnTileToRack = () => {
    if (stagedTileToReassign !== null) {
      const newStagedTiles = { ...stagedTiles };
      delete newStagedTiles[stagedTileToReassign];
      setStagedTiles(newStagedTiles);
      setStagedTileToReassign(null);
    }
    if (selectedBuilderIndex !== null) {
      const newStagedTiles = { ...stagedTiles };
      delete newStagedTiles[selectedBuilderIndex];
      setStagedTiles(newStagedTiles);
      setSelectedBuilderIndex(null);
    }
  };

  const includeBestWordInToast = async (
    title: string,
    description: string = "",
    score: number = 0
  ) => {
    getWordSuggestions(gameState?.board!, currentPlayer?.rack!).then(
      (suggestions) => {
        const bestMove = suggestions.length > 0 ? suggestions[0] : null;
        if (bestMove && bestMove.score > score) {
          description +=
            ` The best word was ${bestMove.word} for ${bestMove.score} points.`.trim();
        }
        toast({ title, description });
      }
    );
  };

  const handlePlayWord = async () => {
    if (!gameState || !authenticatedPlayer) return;
    const placedTilesArray = Object.values(stagedTiles);

    if (placedTilesArray.length === 0) {
      toast({
        title: "Cannot Play",
        description: "You haven't placed any tiles.",
        variant: "destructive",
      });
      return;
    }
    if (tempPlacedTiles.length === 0) {
      toast({
        title: "Cannot Play",
        description: "Please select a starting position on the board.",
        variant: "destructive",
      });
      return;
    }

    const tempBoard = createInitialBoard();
    gameState.history.forEach((h) =>
      h.tiles.forEach((t) => {
        if (tempBoard[t.x]?.[t.y]) tempBoard[t.x][t.y].tile = t;
      })
    );

    const { score, words: allWords } = calculateMoveScore(
      tempPlacedTiles,
      tempBoard
    );

    if (allWords.length === 0) {
      toast({
        title: "Invalid Move",
        description: "No valid words formed.",
        variant: "destructive",
      });
      return;
    }

    const validationPromises = allWords.map((wordInfo) =>
      verifyWordAction(wordInfo.word)
    );
    const validationResults = await Promise.all(validationPromises);
    const invalidWordResult = validationResults.find(
      (result) => !result.isValid
    );

    if (invalidWordResult) {
      const invalidWord =
        allWords[validationResults.indexOf(invalidWordResult)].word;
      toast({
        title: "Invalid Word",
        description: `The word "${invalidWord}" is not valid.`,
        variant: "destructive",
      });
      return;
    }

    await includeBestWordInToast(
      `Played ${allWords[0].word}`,
      `You scored ${score} points.`,
      score
    );

    await handleGenericAction({ type: "play", tiles: tempPlacedTiles });
    resetTurn();
  };

  const handlePassTurn = async () => {
    await includeBestWordInToast(`${authenticatedPlayer?.name} passed.`);
    await handleGenericAction({ type: "pass" });
    resetTurn();
  };

  const showTileBag = () => {
    setIsTileBagOpen(true);
  };

  const getTilesToSwap = () => Object.values(stagedTiles);

  const handleRequestSwap = () => {
    const tilesToSwap = getTilesToSwap();

    if (tilesToSwap.length === 0) {
      toast({
        title: "No Tiles to Swap",
        description: "Select tiles from your rack to stage them for swapping.",
        variant: "destructive",
      });
      return;
    }

    if (gameState && gameState.tileBag.length < tilesToSwap.length) {
      toast({
        title: "Cannot Swap",
        description: "Not enough tiles left in the bag to swap.",
        variant: "destructive",
      });
      return;
    }

    setIsSwapConfirmOpen(true);
  };

  const handleConfirmSwap = async () => {
    setIsSwapConfirmOpen(false);
    const tilesToSwap = getTilesToSwap();
    if (!gameState || !authenticatedPlayer || tilesToSwap.length === 0) return;

    await includeBestWordInToast(
      `Tiles Swapped`,
      `You swapped ${tilesToSwap.length} tiles.`
    );

    await handleGenericAction({ type: "swap", tiles: tilesToSwap });
    setStagedTiles({});
  };

  const resignGame = () => {
    setIsResignConfirmOpen(true);
  };

  const handleConfirmResign = async () => {
    if (!gameState || !authenticatedPlayer) return;

    const action = (currentState: GameState): GameState | null => {
      const newGameState: GameState = JSON.parse(JSON.stringify(currentState));
      const playerToResign = newGameState.players.find(
        (p: Player) => p.id === authenticatedPlayer.id
      );

      if (!playerToResign) {
        toast({
          title: "Error",
          description: "Could not find your player data to resign.",
          variant: "destructive",
        });
        return null;
      }

      const resignEvent: PlayedWord = {
        playerId: playerToResign.id,
        playerName: playerToResign.name,
        word: "[RESIGNED]",
        tiles: [],
        score: 0,
        isResign: true,
        timestamp: new Date().toISOString(),
      };
      newGameState.history.push(resignEvent);

      if (currentState.players.length > 2) {
        newGameState.tileBag.push(...playerToResign.rack);
        newGameState.players = newGameState.players.filter(
          (p: Player) => p.id !== playerToResign.id
        );
        toast({
          title: "You have resigned",
          description: "The game continues without you.",
          variant: "destructive",
        });
        localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
      } else {
        newGameState.gamePhase = "ended";
        const remainingPlayer = newGameState.players.find(
          (p: Player) => p.id !== playerToResign.id
        );
        newGameState.endStatus = remainingPlayer
          ? `${remainingPlayer.name} wins as ${playerToResign.name} resigned`
          : `${playerToResign.name} resigned`;
        toast({
          title: "You have resigned",
          description: "The game is now over.",
          variant: "destructive",
        });
      }
      setIsResignConfirmOpen(false);
      return newGameState;
    };

    // This needs to be a separate call as it modifies the player list
    // The unified `playTurn` action is not suitable here.
    const gameData = await getGameState(gameId);
    if (gameData) {
      const { gameState: currentGameState, sha: currentSha } = gameData;
      const nextState = action(currentGameState);
      if (nextState && currentSha) {
        await updateGame(
          gameId,
          nextState,
          currentSha,
          `Player ${authenticatedPlayer.name} resigned.`
        );
        await fetchGame();
      }
    }
  };

  const handleAuth = (playerId: string) => {
    setAuthenticatedPlayerId(playerId);
    localStorage.setItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`, playerId);
  };

  const handleReplaceWithComputer = async (playerId: string) => {
    setIsLoading(true);
    const result = await replacePlayerWithComputer(gameId, playerId);
    if (result.success) {
      toast({
        title: "Player Replaced",
        description: "The player will now be controlled by the AI.",
      });
      fetchGame();
    } else {
      toast({
        title: "Replacement Failed",
        description: result.error,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  if (isLoading && !gameState) {
    return (
      <div className="text-center p-10 flex items-center justify-center gap-2">
        <RefreshCw className="animate-spin h-5 w-5" /> Loading Game...
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl text-center p-10">
        <Card className="shadow-xl border-destructive">
          <CardHeader>
            <div className="mx-auto bg-destructive text-destructive-foreground rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl text-destructive">
              Error Loading Game
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={() => fetchGame()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/play">
                  <KeyRound className="mr-2 h-4 w-4" /> Join Different Game
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameState) {
    return <div className="text-center p-10">Game not found.</div>;
  }

  const historyDialog = (
    <HistoryDialog
      isOpen={isHistoryOpen}
      onOpenChange={setIsHistoryOpen}
      history={gameState.history}
      players={gameState.players}
    />
  );

  if (gameState.gamePhase === "ended") {
    const winner = gameState.players.reduce(
      (prev, current) => (prev.score > current.score ? prev : current),
      gameState.players[0] || null
    );

    return (
      <div className="container mx-auto text-center p-4 gap-8 flex flex-col items-center">
        <GameBoard
          board={gameState.board}
          tempPlacedTiles={[]}
          onSquareClick={() => {}}
          selectedBoardPos={null}
          playDirection={null}
        />
        <Card className="shadow-xl max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-4xl">Game Over</CardTitle>
            <CardDescription>
              {gameState.endStatus
                ? gameState.endStatus
                : winner
                ? `Winner: ${winner.name} with ${winner.score} points!`
                : "The game ended."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Scoreboard
              players={gameState.players}
              currentPlayerId={currentPlayer?.id || ""}
              authenticatedPlayerId={authenticatedPlayerId}
              isGameOver={gameState.gamePhase === "ended"}
              onReplacePlayer={handleReplaceWithComputer}
              lastMoveTimestamp={
                gameState.history[gameState.history.length - 1]?.timestamp
              }
              onShowHistory={() => setIsHistoryOpen(true)}
            />
            <Button asChild className="mt-4 w-full">
              <Link href="/play">Play Again</Link>
            </Button>
          </CardContent>
        </Card>
        {historyDialog}
      </div>
    );
  }

  if (!authenticatedPlayer) {
    return (
      <div className="container mx-auto flex flex-col-reverse lg:flex-row gap-8 items-start justify-center">
        <div className="w-full lg:w-96 lg:sticky lg:top-20">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-center">Join Game</CardTitle>
              <CardDescription
                className={cn(
                  "text-center",
                  !canJoinGame && !existingPlayer ? "text-destructive" : ""
                )}
              >
                {canJoinGame
                  ? `The game is in progress. ${
                      existingPlayer
                        ? "Enter your code to rejoin"
                        : "Create your player to join"
                    }.`
                  : "The game is closed to new players but existing players can rejoin."}
                {currentPlayer ? ` It's ${currentPlayer.name}'s turn.` : ""}
              </CardDescription>
              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">Game Key</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <p className="text-4xl font-bold tracking-[0.3em] text-primary bg-muted px-4 py-2 rounded-lg">
                    {gameId}
                  </p>
                  <Button variant="ghost" size="icon" onClick={handleCopyLink}>
                    {copied ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Enter your name"
                    value={newPlayerName}
                    onChange={(e) =>
                      setNewPlayerName(e.target.value.toUpperCase())
                    }
                  />
                  <div className="relative">
                    <Input
                      type={showCode ? "text" : "password"}
                      placeholder="Secret code"
                      value={newPlayerCode}
                      onChange={(e) => setNewPlayerCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && joinGame()}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowCode((s) => !s)}
                    >
                      {showCode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={joinGame}
                  className="w-full"
                  disabled={
                    !newPlayerName.trim() ||
                    !newPlayerCode.trim() ||
                    !canJoinGame ||
                    isLoading
                  }
                >
                  {isLoading ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {existingPlayer ? "Rejoin Game" : "Join Game"}
                </Button>

                <div className="space-y-2 pt-4">
                  <h3 className="text-lg font-medium flex items-center">
                    <Users className="mr-2 h-5 w-5" /> Players Already Joined (
                    {gameState.players.length}/4)
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4 min-h-[50px] space-y-2">
                    {gameState.players.length > 0 ? (
                      gameState.players.map((p, i) => (
                        <div
                          key={p.id}
                          className="flex items-center bg-background p-2 rounded-md shadow-sm"
                        >
                          <span className="font-bold text-primary">
                            {i + 1}.
                          </span>
                          <span className="ml-2">{p.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center pt-2">
                        No players have joined yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="container mx-auto text-center p-4 gap-8 flex flex-col items-center">
          <GameBoard
            board={gameState.board}
            tempPlacedTiles={[]}
            onSquareClick={() => {}}
            selectedBoardPos={null}
            playDirection={null}
          />
          <Scoreboard
            players={gameState.players}
            currentPlayerId={currentPlayer?.id || ""}
            authenticatedPlayerId={authenticatedPlayerId}
            onReplacePlayer={handleReplaceWithComputer}
            lastMoveTimestamp={
              gameState.history[gameState.history.length - 1]?.timestamp
            }
            onShowHistory={() => setIsHistoryOpen(true)}
          />
        </div>
        {historyDialog}
      </div>
    );
  }

  if (!authenticatedPlayer && authenticatedPlayerId) {
    return (
      <PlayerAuthDialog
        players={gameState.players.filter(
          (p) => p.id === authenticatedPlayerId
        )}
        onAuth={handleAuth}
      />
    );
  }

  if (!currentPlayer) {
    return (
      <div className="container mx-auto max-w-2xl text-center p-10">
        <Card>
          <CardHeader>
            <CardTitle>Waiting for players...</CardTitle>
            <CardDescription>
              The game will begin when the first player makes a move.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GameBoard
              board={gameState.board}
              tempPlacedTiles={[]}
              onSquareClick={() => {}}
              selectedBoardPos={null}
              playDirection={null}
            />
            <div className="mt-4">
              {authenticatedPlayer && (
                <PlayerRack
                  rack={rackTiles}
                  originalRack={authenticatedPlayer.rack}
                  onTileClick={handleRackTileClick}
                  onRackClick={handleRackClick}
                  isMyTurn={false}
                  playerColor={playerColor}
                  selectedRackTileIndex={selectedRackTileIndex}
                />
              )}
            </div>
          </CardContent>
        </Card>
        {historyDialog}
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-grow">
          <GameBoard
            board={gameState.board}
            tempPlacedTiles={tempPlacedTiles}
            onSquareClick={handleSquareClick}
            selectedBoardPos={selectedBoardPos}
            playDirection={playDirection}
          />
        </div>
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {authenticatedPlayer && (
            <div className="lg:sticky lg:top-4 space-y-4 z-10">
              <PlayerRack
                rack={rackTiles}
                originalRack={authenticatedPlayer.rack}
                onTileClick={handleRackTileClick}
                onRackClick={handleRackClick}
                isMyTurn={isMyTurn}
                playerColor={playerColor}
                selectedRackTileIndex={selectedRackTileIndex}
              />
              {gameState && (
                <WordBuilder
                  slots={wordBuilderSlots}
                  stagedTiles={stagedTiles}
                  onStagedTileClick={handleStagedTileClick}
                  onBuilderSlotClick={handleBuilderSlotClick}
                  selectedBuilderIndex={selectedBuilderIndex}
                  board={gameState.board}
                  tempPlacedTiles={tempPlacedTiles}
                  playDirection={playDirection}
                  playerColor={playerColor}
                  onBlankTileReassign={(index: number) => {
                    setStagedTileToReassign(index);
                    setIsBlankTileDialogOpen(true);
                  }}
                />
              )}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PencilRuler className="h-5 w-5" />
                <span style={{ userSelect: "none" }}>Game</span> {gameId}
              </CardTitle>
              <CardDescription>
                It's {currentPlayer.name}'s turn.{" "}
                {isPolling && (
                  <RefreshCw className="inline-block animate-spin h-4 w-4 ml-2" />
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                onClick={() => handlePlayWord()}
                disabled={
                  Object.keys(stagedTiles).length === 0 || !isMyTurn || isLoading
                }
                className="bg-accent hover:bg-accent/80 text-accent-foreground"
              >
                {isLoading && !isPolling ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  "Play Word"
                )}
              </Button>
              <Button
                variant="ghost"
                disabled={isLoading || !gameState?.tileBag.length}
                onClick={showTileBag}
              >
                {`${gameState.tileBag.length} Tiles Left`}
              </Button>
              <Button
                variant="outline"
                disabled={!isMyTurn || isLoading || !!selectedBoardPos}
                onClick={handleRequestSwap}
              >
                Swap Tiles
              </Button>
              <Button
                variant="secondary"
                disabled={!isMyTurn || isLoading}
                onClick={() => handlePassTurn()}
              >
                Pass Turn
              </Button>
              <Button
                variant="secondary"
                onClick={resetTurn}
                disabled={Object.keys(stagedTiles).length === 0}
              >
                Reset Rack
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={resignGame}
                disabled={isLoading}
              >
                Resign Game
              </Button>
            </CardContent>
          </Card>
          <Scoreboard
            players={gameState.players}
            currentPlayerId={currentPlayer.id}
            authenticatedPlayerId={authenticatedPlayerId}
            onReplacePlayer={handleReplaceWithComputer}
            lastMoveTimestamp={
              gameState.history[gameState.history.length - 1]?.timestamp
            }
            onShowHistory={() => setIsHistoryOpen(true)}
          />
          <Card>
            <CardHeader>
              <CardTitle
                className="flex items-center gap-2"
                aria-description="Support, Help, Feedback"
              >
                <LifeBuoy className="h-5 w-5" />
                Support
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={() => setIsSuggestWordOpen(true)}>
                <GitPullRequestCreate className="mr-2 h-4 w-4" /> Suggest a Word
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsReportBugOpen(true)}
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" /> Report a Bug
              </Button>
              <Button asChild variant="outline">
                <Link
                  href="https://playscrabble.com/news-blog/scrabble-rules-official-scrabble-web-games-rules-play-scrabble"
                  target="_blank"
                >
                  <HelpingHand className="mr-2 h-4 w-4" /> Learn how to play
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={isSwapConfirmOpen} onOpenChange={setIsSwapConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Tile Swap</DialogTitle>
            <DialogDescription>
              Are you sure you want to swap{" "}
              {Object.keys(stagedTiles).length} tile(s)? This will end your turn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsSwapConfirmOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => handleConfirmSwap()}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="animate-spin" />
              ) : (
                "Confirm Swap"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isSuggestWordOpen} onOpenChange={setIsSuggestWordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest a New Word</DialogTitle>
            <DialogDescription>
              If you think a word should be valid, you can suggest it here. This
              If approved it will be added to the dictionary.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value.toUpperCase())}
            placeholder="Enter word (e.g. ZAAP)"
            disabled={isSubmittingSuggestion}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsSuggestWordOpen(false)}
              disabled={isSubmittingSuggestion}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSuggestWord}
              disabled={!newWord.trim() || isSubmittingSuggestion}
            >
              {isSubmittingSuggestion ? (
                <RefreshCw className="animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReportBugDialog
        isReportBugOpen={isReportBugOpen}
        setIsReportBugOpen={setIsReportBugOpen}
        gameId={gameId}
        authenticatedPlayer={authenticatedPlayer || undefined}
        sha={sha}
      />
      <Dialog open={isTileBagOpen} onOpenChange={setIsTileBagOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remaining Tiles</DialogTitle>
            <DialogDescription>
              There are {gameState.tileBag.length} tiles left in the bag.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-2 gap-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {tileBagContents.map(({ tile, count }) => (
              <div
                key={tile.letter || "BLANK"}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 flex-shrink-0">
                  <SingleTile tile={tile} isDraggable={false} playerColor={playerColor}/>
                </div>
                <span className="font-bold text-lg">x {count}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTileBagOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isResignConfirmOpen} onOpenChange={setIsResignConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Resignation</DialogTitle>
            <DialogDescription>
              Are you sure you want to resign?
              {gameState && gameState.players.length > 2
                ? " Your tiles will be returned to the bag and the game will continue without you."
                : " This will end the game."}{" "}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsResignConfirmOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmResign}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="animate-spin" />
              ) : (
                "Confirm Resign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BlankTileDialog
        isOpen={isBlankTileDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setBlankTileToStage(null);
            setStagedTileToReassign(null);
          }
          setIsBlankTileDialogOpen(isOpen);
        }}
        onSelect={handleBlankTileSelect}
        onReturnToRack={handleReturnTileToRack}
        showReturnToRack={stagedTileToReassign !== null || (selectedBuilderIndex !== null && !!stagedTiles[selectedBuilderIndex])}
      />
      {historyDialog}
    </div>
  );
}
