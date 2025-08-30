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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import GameBoard from "./game-board";
import PlayerRack from "./player-rack";
import Scoreboard from "./scoreboard";
import {
  getGameState,
  suggestWordAction,
  updateGameState,
  verifyWordAction,
} from "@/app/actions";
import Link from "next/link";
import { PlayerAuthDialog } from "./player-auth-dialog";
import WordBuilder from "./word-builder";
import { calculateMoveScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import SingleTile from "./tile";
import { BlankTileDialog } from "./blank-tile-dialog";
import { ReportBugDialog } from "./ui/report-bug-dialog";

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

  const [stagedTiles, setStagedTiles] = useState<PlacedTile[]>([]);
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
  const [isResignConfirmOpen, setIsResignConfirmOpen] = useState(false);
  const [isBlankTileDialogOpen, setIsBlankTileDialogOpen] = useState(false);
  const [blankTileToStage, setBlankTileToStage] = useState<Tile | null>(null);
  const [stagedTileToReassign, setStagedTileToReassign] = useState<
    number | null
  >(null);

  const [authenticatedPlayerId, setAuthenticatedPlayerId] = useState<
    string | null
  >(null);

  const lastMoveTimestampRef = useRef<string | null>(null);

  const handleReorderStagedTiles = (newOrder: PlacedTile[]) => {
    setStagedTiles(newOrder);
  };

  const { toast } = useToast();

  const shuffle = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const checkAndEndGame = (gameState: GameState): GameState => {
    const { players, history, tileBag } = gameState;
    const numPlayers = players.length;

    if (numPlayers === 0 || gameState.gamePhase === "ended") return gameState;

    // Condition 1: A player has used all their tiles and the bag is empty.
    const playerWithEmptyRack = players.find((p) => p.rack.length === 0);
    if (tileBag.length === 0 && playerWithEmptyRack) {
      const newGameState = JSON.parse(JSON.stringify(gameState));
      newGameState.gamePhase = "ended";

      let pointsFromRacks = 0;
      newGameState.players.forEach((p: Player) => {
        const rackValue = p.rack.reduce((sum, tile) => sum + tile.points, 0);
        if (p.id !== playerWithEmptyRack.id) {
          p.score -= rackValue;
          pointsFromRacks += rackValue;
        }
      });

      const finishingPlayer = newGameState.players.find(
        (p: Player) => p.id === playerWithEmptyRack.id
      )!;
      finishingPlayer.score += pointsFromRacks;

      const winningScore = Math.max(
        ...newGameState.players.map((p: Player) => p.score)
      );
      const winners = newGameState.players.filter((p: Player) => {
        return p.score === winningScore;
      });
      if (winners.length > 1) {
        const winnerNames = winners.map((w: Player) => w.name).join(" and ");
        newGameState.endStatus = `${winnerNames} win after ${finishingPlayer.name} used all their tiles!`;
      } else if (winners.length === 1) {
        if (winners[0].id === finishingPlayer.id) {
          newGameState.endStatus = `${finishingPlayer.name} wins after using all their tiles!`;
        } else {
          newGameState.endStatus = `${winners[0].name} wins after ${finishingPlayer.name} used all their tiles!`;
        }
      }
      return newGameState;
    }

    // Condition 2: All players have passed twice consecutively.
    if (history.length >= numPlayers * 2) {
      const lastMoves = history.slice(-numPlayers * 2);
      if (lastMoves.every((move) => move.isPass)) {
        const newGameState = JSON.parse(JSON.stringify(gameState));
        newGameState.gamePhase = "ended";

        // adjust score for winning players
        // all players have their rack values subtracted from their score
        // since no one used all their tiles, no one gets those points added to their score
        newGameState.players.forEach((p: Player) => {
          const rackValue = p.rack.reduce((sum, tile) => sum + tile.points, 0);
          p.score -= rackValue;
        });

        const winningScore = 0;
        const winners: Player[] = [];
        newGameState.players.forEach((p: Player) => {
          if (p.score > winningScore) {
            winners.splice(0, winners.length, p);
          } else if (p.score === winningScore) {
            winners.push(p);
          } else {
            // do nothing
          }
        });
        if (winners.length > 1) {
          const winnerNames = winners.map((w) => w.name).join(" and ");
          newGameState.endStatus = `${winnerNames} win after two rounds of passes`;
        } else if (winners.length === 1) {
          newGameState.endStatus = `${winners[0].name} wins after two rounds of passes`;
        } else {
          // This should not happen, but just in case
          newGameState.endStatus =
            "Game ended after two rounds of passes. Somehow no winner could be determined";
        }

        return newGameState;
      }
    }

    return gameState;
  };

  const fetchGame = useCallback(
    async (isPoll = false) => {
      if (!isPoll) setIsLoading(true);
      else setIsPolling(true);
      setError(null);
      try {
        const gameData = await getGameState(gameId);
        if (gameData) {
          // Only update state if the SHA has changed, to avoid re-renders
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

  useEffect(() => {
    fetchGame();
    // Set up polling every 5 seconds
    const intervalId = setInterval(() => fetchGame(true), 5000);
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchGame]);

  const resetTurn = useCallback(() => {
    setStagedTiles([]);
    setSelectedBoardPos(null);
    setPlayDirection(null);
  }, []);

  const handleLeaveGame = useCallback(() => {
    // Reset turn on leave game
    resetTurn();

    localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
    setAuthenticatedPlayerId(null);
    toast({
      title: "Left Game",
      description: "You have returned to the lobby.",
    });
  }, [gameId, toast, resetTurn]);

  // Request notification permission when component mounts
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Effect for showing notifications for opponent moves
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

      // Ensure permission is granted before trying to show a notification
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
          icon: "/favicon.ico", // PWA icon
          badge: "/favicon.ico", // A smaller badge icon
          vibrate: [100, 50, 100], // Vibrate pattern
        };

        // Use the Service Worker to show the notification if available, for background support
        if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
          });
        } else {
          // Fallback to regular notification if service worker isn't ready
          new Notification(title, options);
        }
      }
    } else if (!lastMove) {
      lastMoveTimestampRef.current = null;
    }
  }, [gameState, authenticatedPlayerId]);

  useEffect(() => {
    // Add gameId to local storage history
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
    // Check for stored player ID
    const storedPlayerId = localStorage.getItem(
      `${LocalStorageKey.PLAYER_ID_}${gameId}`
    );
    if (storedPlayerId) {
      // We will validate this against the game state once it loads.
      setAuthenticatedPlayerId(storedPlayerId);
    }
    // Pass the leave handler up to the parent page component
    setLeaveGameHandler(() => handleLeaveGame);
  }, [gameId, setLeaveGameHandler, handleLeaveGame]);

  useEffect(() => {
    if (gameState && authenticatedPlayerId) {
      // If a stored player ID is not actually in the game, clear it.
      if (!gameState.players.some((p) => p.id === authenticatedPlayerId)) {
        setAuthenticatedPlayerId(null);
        localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
      }
    }
  }, [gameState, authenticatedPlayerId, gameId]);

  const turnsPlayed = useMemo(
    () => gameState?.history?.length ?? 0,
    [gameState]
  );

  const currentPlayer = useMemo(() => {
    if (!gameState || gameState.players.length === 0) return null;

    // Before first player has played twice, turn order is by newest player who hasn't played
    if (turnsPlayed < gameState.players.length) {
      const playedPlayerIds = new Set(gameState.history.map((h) => h.playerId));
      const waitingPlayers = gameState.players.filter(
        (p) => !playedPlayerIds.has(p.id)
      );
      // The next player is the one who joined earliest among those who haven't played
      if (waitingPlayers.length > 0) {
        return waitingPlayers[0];
      }
    }

    // After that, it's just based on join order.
    const playerIndex = turnsPlayed % gameState.players.length;
    return gameState.players[playerIndex];
  }, [gameState, turnsPlayed]);

  const authenticatedPlayer = useMemo(() => {
    if (!gameState || !authenticatedPlayerId) return null;
    return (
      gameState.players.find((p) => p.id === authenticatedPlayerId) ?? null
    );
  }, [gameState, authenticatedPlayerId]);

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
    // An existing player trying to rejoin is always allowed
    if (existingPlayer) {
      return true;
    }
    // New players can join if the lobby is not full and the game has not started
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

    const stagedLettersCopy = stagedTiles.map(
      (t) => t.originalLetter ?? t.letter
    );
    const rackCopy = [...authenticatedPlayer.rack];

    // Filter out staged letters from the rack display
    const availableTiles = rackCopy.filter((rackTile) => {
      const index = stagedLettersCopy.indexOf(rackTile.letter);
      if (index > -1) {
        // Remove the letter from the copy so it can't be used to filter out another identical tile
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

    // Based on direction, find the start of the word by backtracking over existing tiles
    if (playDirection === "horizontal") {
      while (currentY > 0 && gameState.board[currentX][currentY - 1].tile) {
        currentY--;
      }
    } else {
      // vertical
      while (currentX > 0 && gameState.board[currentX - 1][currentY].tile) {
        currentX--;
      }
    }

    let emptySlotsCount = 0;

    // Now build forward to create the slots
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
    if (!selectedBoardPos || !playDirection || !wordBuilderSlots.length)
      return [];

    const placed: PlacedTile[] = [];
    let tileIndex = 0;

    let { x: startX, y: startY } = selectedBoardPos;

    // Backtrack to the start of the word on the board
    if (playDirection === "horizontal") {
      while (startY > 0 && gameState?.board[startX][startY - 1].tile) {
        startY--;
      }
    } else {
      while (startX > 0 && gameState?.board[startX - 1][startY].tile) {
        startX--;
      }
    }

    // Iterate through the slots and fill in the staged tiles at the correct coordinates
    for (let i = 0; i < wordBuilderSlots.length; i++) {
      const currentSlot = wordBuilderSlots[i];
      const currentX = playDirection === "vertical" ? startX + i : startX;
      const currentY = playDirection === "horizontal" ? startY + i : startY;

      if (currentX >= 15 || currentY >= 15) break;

      if (currentSlot.tile === null) {
        // This is an empty slot to be filled
        if (tileIndex < stagedTiles.length) {
          placed.push({ ...stagedTiles[tileIndex], x: currentX, y: currentY });
          tileIndex++;
        }
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
      if (a.tile.letter === "") return 1; // Blanks at the end
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

  const performGameAction = async (
    action: (
      currentState: GameState
    ) => GameState | Promise<GameState | null> | null,
    message: string
  ): Promise<GameState | null> => {
    setIsLoading(true);
    try {
      const gameData = await getGameState(gameId);
      if (!gameData) {
        toast({
          title: "Error",
          description: "Game not found. It might have been deleted.",
          variant: "destructive",
        });
        setError(`Game with ID "${gameId}" not found.`);
        return null;
      }

      const newGameState = await action(gameData.gameState);

      if (newGameState) {
        await updateGameState(gameId, newGameState, gameData.sha, message);
        // After successful update, refetch to get new SHA and confirm state
        await fetchGame();
        return newGameState;
      }
      return null;
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Action Failed",
        description:
          e.message ||
          "Could not perform the action. The game state may have changed. Please try again.",
        variant: "destructive",
      });
      // Refetch to get latest state in case of conflict
      await fetchGame();
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const joinGame = async () => {
    // Reset turn on join game
    resetTurn();

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

    const currentGameData = await getGameState(gameId);
    if (!currentGameData) return;

    const existingPlayerInGame = currentGameData.gameState.players.find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingPlayerInGame) {
      if (existingPlayerInGame.code === trimmedCode) {
        handleAuth(existingPlayerInGame.id);
        toast({
          title: "Welcome back!",
          description: `You have rejoined the game as ${existingPlayerInGame.name}.`,
        });
        return;
      } else {
        toast({
          title: "Cannot Join",
          description:
            "A player with that name already exists, but the code is incorrect.",
          variant: "destructive",
        });
        return;
      }
    }

    const action = (currentState: GameState) => {
      if (lobbyFull) {
        toast({
          title: "Cannot Join Game",
          description: `Lobby is full (max ${MAX_PLAYER_COUNT} players).`,
          variant: "destructive",
        });
        return null;
      }
      if (gameStarted) {
        toast({
          title: "Cannot Join Game",
          description: "The game has already started.",
          variant: "destructive",
        });
        return null;
      }

      const currentTileBag = [...currentState.tileBag];
      const tilesToDraw = Math.min(7, currentTileBag.length);
      if (tilesToDraw < 7) {
        toast({
          title: "Cannot Join Game",
          description: "Not enough tiles left in the bag to start.",
          variant: "destructive",
        });
        return null;
      }
      const newTiles = currentTileBag.splice(0, tilesToDraw);

      const newPlayer: Player = {
        id: `p${Date.now()}`,
        name: trimmedName,
        score: 0,
        rack: newTiles,
        code: trimmedCode,
      };

      return {
        ...currentState,
        players: [...currentState.players, newPlayer],
        tileBag: currentTileBag,
      };
    };

    const message = `feat: Player ${trimmedName} joined game ${gameId}`;
    const updatedGameState = await performGameAction(action, message);

    if (updatedGameState) {
      const newPlayer = updatedGameState.players.find(
        (p) => p.name === trimmedName
      );
      if (newPlayer) {
        handleAuth(newPlayer.id);
        // Add gameId to local storage history after successful join
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
      }
      setNewPlayerName("");
      setNewPlayerCode("");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSquareClick = (x: number, y: number) => {
    if (selectedBoardPos?.x === x && selectedBoardPos?.y === y) {
      // Cycle through directions or deselect
      if (playDirection === "horizontal") {
        setPlayDirection("vertical");
      } else if (playDirection === "vertical") {
        setSelectedBoardPos(null);
        setPlayDirection(null);
        // As per TODO only clear staged tiles on reset
        // setStagedTiles([]); // Clear staged tiles on deselect
      }
    } else {
      // New selection
      setSelectedBoardPos({ x, y });
      setPlayDirection(playDirection || "horizontal");
      // As per TODO only clear staged tiles on reset
      //  setStagedTiles([]); // Clear staged tiles on new selection
    }
  };

  const handleRackTileClick = (tile: Tile) => {
    if (!gameState) return;

    if (tile.letter === " ") {
      setBlankTileToStage(tile);
      setIsBlankTileDialogOpen(true);
      return;
    }

    // Determine how many tiles can still be placed
    const emptySlots = wordBuilderSlots.filter((s) => s.tile === null).length;
    if (stagedTiles.length >= emptySlots || stagedTiles.length >= 7) {
      toast({
        title: "Stage Full",
        description: "No more space to add tiles for this word.",
        variant: "destructive",
      });
      return;
    }

    // Add the new tile to the staging area.
    // The `tempPlacedTiles` memo will calculate its correct (x, y) coordinates.
    setStagedTiles((prev) => [...prev, { ...tile, x: -1, y: -1 }]); // Use placeholder coords
  };

  const handleStagedTileClick = (index: number) => {
    const tile = stagedTiles[index];
    if (tile.originalLetter === " ") {
      setStagedTileToReassign(index);
      setIsBlankTileDialogOpen(true);
    } else {
      setStagedTiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleBlankTileSelect = (letter: string) => {
    if (stagedTileToReassign !== null) {
      // Reassigning letter for an already staged blank tile
      const newStagedTiles = [...stagedTiles];
      newStagedTiles[stagedTileToReassign].letter = letter;
      setStagedTiles(newStagedTiles);
      setStagedTileToReassign(null);
    } else if (blankTileToStage) {
      // Staging a new blank tile from the rack
      const newTile: PlacedTile = {
        ...blankTileToStage,
        letter: letter,
        originalLetter: " ",
        x: -1,
        y: -1,
      };
      setStagedTiles((prev) => [...prev, newTile]);
      setBlankTileToStage(null);
    }
  };

  const handleReturnTileToRack = () => {
    if (stagedTileToReassign !== null) {
      const newStagedTiles = stagedTiles.filter(
        (_, i) => i !== stagedTileToReassign
      );
      setStagedTiles(newStagedTiles);
      setStagedTileToReassign(null);
    }
    // No need to do anything if it's a new blank tile, as it hasn't been staged yet.
  };

  const handlePlayWord = async () => {
    if (!gameState || !authenticatedPlayer) return;
    if (stagedTiles.length === 0) {
      toast({
        title: "Cannot Play",
        description: "You haven't placed any tiles.",
        variant: "destructive",
      });
      return;
    }

    // --- Placement and Word Calculation ---
    const { score, words: allWords } = calculateMoveScore(
      tempPlacedTiles,
      gameState.board
    );
    const mainWordInfo =
      allWords.find((w) => w.direction === (playDirection || "horizontal")) ||
      allWords[0];

    if (!mainWordInfo || mainWordInfo.word.length < 2) {
      toast({
        title: "Cannot Play",
        description: mainWordInfo
          ? "A word must be at least 2 letters long."
          : "You need to place the tiles on valid squares.",
        variant: "destructive",
      });
      return;
    }

    // --- Validation for placement ---
    const isFirstMove = gameState.history.length === 0;
    if (isFirstMove) {
      const coversCenter = tempPlacedTiles.some((t) => t.x === 7 && t.y === 7);
      if (!coversCenter) {
        toast({
          title: "Invalid Placement",
          description: "The first word must cover the center star.",
          variant: "destructive",
        });
        return;
      }
    } else {
      const isConnected = tempPlacedTiles.some((tile) => {
        const { x, y } = tile;
        const neighbors = [
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
        ];
        return neighbors.some((n) => {
          const checkX = x + n.dx;
          const checkY = y + n.dy;
          if (checkX >= 0 && checkX < 15 && checkY >= 0 && checkY < 15) {
            return !!gameState.board[checkX][checkY].tile;
          }
          return false;
        });
      });

      if (!isConnected) {
        toast({
          title: "Invalid Placement",
          description: "New words must connect to existing tiles on the board.",
          variant: "destructive",
        });
        return;
      }
    }
    // --- End Validation ---

    setIsLoading(true);
    try {
      // --- Word Verification ---
      const validationPromises = allWords.map((wordInfo) =>
        verifyWordAction(wordInfo.word)
      );
      const validationResults = await Promise.all(validationPromises);

      const invalidWordIndex = validationResults.findIndex(
        (result) => !result.isValid
      );

      if (invalidWordIndex > -1) {
        const invalidWord = allWords[invalidWordIndex].word;
        toast({
          title: "Invalid Word",
          description: `The word "${invalidWord}" is not valid.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // --- All words are valid, proceed with action ---
      const action = (currentState: GameState) => {
        const currentTurnPlayerIndex =
          currentState.history.length % currentState.players.length;
        const currentTurnPlayer = currentState.players[currentTurnPlayerIndex];

        if (currentTurnPlayer.id !== authenticatedPlayerId) {
          throw new Error(
            `It's not your turn. It's ${currentTurnPlayer.name}'s turn.`
          );
        }

        const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy

        const playerToUpdate = newGameState.players.find(
          (p: Player) => p.id === authenticatedPlayerId
        )!;
        playerToUpdate.score += score;

        // Remove played tiles from rack and replenish from bag
        const tilesToDraw = tempPlacedTiles.length;
        const newTiles = newGameState.tileBag.slice(0, tilesToDraw);

        let rackAfterPlay = [...playerToUpdate.rack];
        const stagedLetters = stagedTiles.map(
          (t) => t.originalLetter ?? t.letter
        );

        stagedLetters.forEach((letter) => {
          const indexToRemove = rackAfterPlay.findIndex(
            (t) => t.letter === letter
          );
          if (indexToRemove > -1) {
            rackAfterPlay.splice(indexToRemove, 1);
          }
        });

        rackAfterPlay.push(...newTiles);
        playerToUpdate.rack = rackAfterPlay;
        newGameState.tileBag.splice(0, tilesToDraw);

        // Add the played word to history
        const playedWord: PlayedWord = {
          playerId: playerToUpdate.id,
          playerName: playerToUpdate.name,
          word: mainWordInfo.word,
          tiles: tempPlacedTiles, // Only store the tiles placed by the user this turn
          score: score,
          timestamp: new Date().toISOString(),
        };

        newGameState.history.push(playedWord);

        resetTurn();
        toast({
          title: `Played ${playedWord.word}`,
          description: `Scored ${score} points.`,
        });
        return checkAndEndGame(newGameState);
      };

      const message = `feat: ${authenticatedPlayer.name} played ${mainWordInfo.word} for ${score} points in game ${gameId}`;
      await performGameAction(action, message);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Could not verify word.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassTurn = async () => {
    if (!gameState || !authenticatedPlayer) return;

    const action = (currentState: GameState) => {
      const currentTurnPlayerIndex =
        currentState.history.length % currentState.players.length;
      const currentTurnPlayer = currentState.players[currentTurnPlayerIndex];

      if (currentTurnPlayer.id !== authenticatedPlayerId) {
        throw new Error(
          `It's not your turn. It's ${currentTurnPlayer.name}'s turn.`
        );
      }

      const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy

      // Add a "pass" event to history to advance the turn
      const passEvent: PlayedWord = {
        playerId: authenticatedPlayer.id,
        playerName: authenticatedPlayer.name,
        word: "[PASS]",
        tiles: [],
        score: 0,
        isPass: true,
        timestamp: new Date().toISOString(),
      };

      newGameState.history.push(passEvent);

      resetTurn();
      toast({ title: "Turn Passed" });
      return checkAndEndGame(newGameState);
    };

    const message = `feat: ${authenticatedPlayer.name} passed their turn in game ${gameId}`;
    await performGameAction(action, message);
  };

  const showTileBag = () => {
    setIsTileBagOpen(true);
  };

  // Only staged tiles without coordinates
  const getTilesToSwap = () =>
    stagedTiles.filter((t) => t.x === -1 && t.y === -1);

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

    const action = (currentState: GameState) => {
      const currentTurnPlayerIndex =
        currentState.history.length % currentState.players.length;
      const currentTurnPlayer = currentState.players[currentTurnPlayerIndex];

      if (currentTurnPlayer.id !== authenticatedPlayerId) {
        throw new Error(
          `It's not your turn. It's ${currentTurnPlayer.name}'s turn.`
        );
      }

      const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy
      const playerToUpdate = newGameState.players.find(
        (p: Player) => p.id === authenticatedPlayerId
      )!;
      const tileBag = newGameState.tileBag;

      const lettersToSwap = tilesToSwap.map(
        (t) => t.originalLetter ?? t.letter
      );
      const rackAfterSwap = [...playerToUpdate.rack];
      const swappedOutTiles: Tile[] = [];

      lettersToSwap.forEach((letter) => {
        const indexToRemove = rackAfterSwap.findIndex(
          (t) => t.letter === letter
        );
        if (indexToRemove > -1) {
          swappedOutTiles.push(rackAfterSwap.splice(indexToRemove, 1)[0]);
        }
      });

      const newTiles = tileBag.splice(0, swappedOutTiles.length);
      rackAfterSwap.push(...newTiles);
      playerToUpdate.rack = rackAfterSwap;

      tileBag.push(...swappedOutTiles);
      newGameState.tileBag = shuffle(tileBag);

      const swapEvent: PlayedWord = {
        playerId: authenticatedPlayer.id,
        playerName: authenticatedPlayer.name,
        word: "[SWAP]",
        tiles: [],
        score: 0,
        isSwap: true,
        timestamp: new Date().toISOString(),
      };
      newGameState.history.push(swapEvent);

      toast({
        title: "Tiles Swapped",
        description: `You swapped ${tilesToSwap.length} tiles.`,
      });
      return checkAndEndGame(newGameState);
    };

    const message = `feat: ${authenticatedPlayer.name} swapped ${tilesToSwap.length} tiles in game ${gameId}`;
    const updatedState = await performGameAction(action, message);

    if (updatedState) {
      setStagedTiles([]);
    }
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

      // Add a "resign" event to history. This advances the turn.
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

      // If more than 2 players are in the game, remove the resigning player and continue.
      if (currentState.players.length > 2) {
        // Return the player's tiles to the tile bag
        newGameState.tileBag.push(...playerToResign.rack);
        newGameState.tileBag = shuffle(newGameState.tileBag);

        // Remove the player from the game
        newGameState.players = newGameState.players.filter(
          (p: Player) => p.id !== playerToResign.id
        );

        toast({
          title: "You have resigned",
          description:
            "Your tiles have been returned to the bag. The game continues without you.",
          variant: "destructive",
        });

        // After resigning, the player is no longer authenticated for this game.
        // The useEffect hook will handle de-authing the user on the next render.
        localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
      } else {
        // 2 or fewer players, so the game ends.
        newGameState.gamePhase = "ended";
        const remainingPlayer = newGameState.players.find(
          (p: Player) => p.id !== playerToResign.id
        );

        if (remainingPlayer) {
          newGameState.endStatus = `${remainingPlayer.name} wins as ${playerToResign.name} resigned`;
        } else {
          // This case happens if a player resigns from a 1-player game.
          newGameState.endStatus = `${playerToResign.name} resigned`;
        }

        toast({
          title: "You have resigned",
          description: "The game is now over.",
          variant: "destructive",
        });
      }

      setIsResignConfirmOpen(false);
      return newGameState;
    };

    const message = `feat: ${authenticatedPlayer.name} resigned from game ${gameId}`;
    await performGameAction(action, message);
  };

  const handleAuth = (playerId: string) => {
    setAuthenticatedPlayerId(playerId);
    localStorage.setItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`, playerId);
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
            />
            <Button asChild className="mt-4 w-full">
              <Link href="/play">Play Again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show join screen if not authenticated
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
          />
        </div>
      </div>
    );
  }

  // Show auth dialog if we have a player ID but they need to enter a code (e.g. new device)
  // TODO: validate why this would ever happen
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

  const authenticatedPlayerIndex = gameState!.players.findIndex(
    (p) => p.id === authenticatedPlayerId
  );
  const playerColor =
    PLAYER_COLORS[authenticatedPlayerIndex % PLAYER_COLORS.length];

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
                  rack={authenticatedPlayer.rack}
                  onTileSelect={handleRackTileClick}
                  isMyTurn={false}
                  playerColor={playerColor}
                />
              )}
            </div>
          </CardContent>
        </Card>
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
                onTileSelect={handleRackTileClick}
                isMyTurn={isMyTurn}
                playerColor={playerColor}
              />
              {gameState && (
                <WordBuilder
                  slots={wordBuilderSlots}
                  stagedTiles={stagedTiles}
                  onStagedTileClick={handleStagedTileClick}
                  onReorderStagedTiles={handleReorderStagedTiles}
                  board={gameState.board}
                  tempPlacedTiles={tempPlacedTiles}
                  playerColor={playerColor}
                  playDirection={playDirection}
                />
              )}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PencilRuler className="h-5 w-5" />
                Controls
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
                onClick={handlePlayWord}
                disabled={stagedTiles.length === 0 || !isMyTurn || isLoading}
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
                onClick={handlePassTurn}
              >
                Pass Turn
              </Button>
              <Button
                variant="secondary"
                onClick={resetTurn}
                disabled={stagedTiles.length === 0}
              >
                {/* Do not change this text */}
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
              {stagedTiles.filter((t) => t.x === -1 && t.y === -1).length}{" "}
              tile(s)? This will end your turn.
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
              onClick={handleConfirmSwap}
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
        authenticatedPlayer={authenticatedPlayer}
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
                  <SingleTile tile={tile} isDraggable={false} />
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
        showReturnToRack={stagedTileToReassign !== null}
      />
    </div>
  );
}
