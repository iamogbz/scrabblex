
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalStorageKey, PLAYER_COLORS } from '@/lib/constants';
import type { GameState, Player, Tile, PlacedTile, PlayedWord, BoardSquare, Board } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserPlus, Play, Copy, Check, Users, RefreshCw, AlertTriangle, KeyRound, EyeOff, Eye, ArrowDown, ArrowRight, LogOut, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GameBoard from './game-board';
import PlayerRack from './player-rack';
import Scoreboard from './scoreboard';
import { getGameState, updateGameState, verifyWordAction } from '@/app/actions';
import Link from 'next/link';
import { PlayerAuthDialog } from './player-auth-dialog';
import WordBuilder from './word-builder';
import { calculateMoveScore } from '@/lib/scoring';


export default function GameClient({ gameId, setLeaveGameHandler }: { gameId: string, setLeaveGameHandler: (handler: () => void) => void }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerCode, setNewPlayerCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const [stagedTiles, setStagedTiles] = useState<PlacedTile[]>([]);
  const [selectedBoardPos, setSelectedBoardPos] = useState<{ x: number, y: number } | null>(null);
  const [playDirection, setPlayDirection] = useState<'horizontal' | 'vertical' | null>(null);

  const [authenticatedPlayerId, setAuthenticatedPlayerId] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchGame = useCallback(async (isPoll = false) => {
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
        setError(`Game with ID "${gameId}" not found. Check the key or create a new game.`);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load game data. Please try again.");
    } finally {
      if (!isPoll) setIsLoading(false);
      else setIsPolling(false);
    }
  }, [gameId, sha]);

  useEffect(() => {
    fetchGame();
    // Set up polling every 5 seconds
    const intervalId = setInterval(() => fetchGame(true), 5000);
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchGame]);

  const handleLeaveGame = useCallback(() => {
    localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
    setAuthenticatedPlayerId(null);
    toast({ title: "Left Game", description: "You have returned to the lobby." });
  }, [gameId, toast]);

  useEffect(() => {
    // Add gameId to local storage history
    const gameHistory = new Set(JSON.parse(localStorage.getItem(LocalStorageKey.GAMES) || '[]'));
    if (!gameHistory.has(gameId)) {
      gameHistory.add(gameId);
      localStorage.setItem(LocalStorageKey.GAMES, JSON.stringify(Array.from(gameHistory).sort()));
    }
    // Check for stored player ID
    const storedPlayerId = localStorage.getItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
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
      if (!gameState.players.some(p => p.id === authenticatedPlayerId)) {
        setAuthenticatedPlayerId(null);
        localStorage.removeItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`);
      }
    }
  }, [gameState, authenticatedPlayerId, gameId]);

  const turnsPlayed = useMemo(() => gameState?.history?.length ?? 0, [gameState]);

  const currentPlayer = useMemo(() => {
    if (!gameState || gameState.players.length === 0) return null;

    // Before first player has played twice, turn order is by newest player who hasn't played
    if (turnsPlayed < gameState.players.length) {
      const playedPlayerIds = new Set(gameState.history.map(h => h.playerId));
      const waitingPlayers = gameState.players.filter(p => !playedPlayerIds.has(p.id));
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
    return gameState.players.find(p => p.id === authenticatedPlayerId) ?? null;
  }, [gameState, authenticatedPlayerId]);

  const existingPlayer = useMemo(() => {
    if (!gameState || !newPlayerName) return null;
    return gameState.players.find(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase());
  }, [gameState, newPlayerName]);

  const canJoinGame = useMemo(() => {
    if (!gameState) return false;
    // An existing player trying to rejoin is always allowed
    if (existingPlayer) {
      return true;
    }
    // New players can join if the lobby is not full.
    if (gameState.players.length < 4) return true;

    return false;
  }, [gameState, existingPlayer]);

  const isMyTurn = useMemo(() => {
    return authenticatedPlayerId === currentPlayer?.id;
  }, [authenticatedPlayerId, currentPlayer]);

  const rackTiles = useMemo(() => {
    if (!authenticatedPlayer) return [];

    // Create a mutable copy of the staged tile letters to track usage
    const stagedLettersCopy = stagedTiles.map(t => t.letter);
    const rackCopy = [...authenticatedPlayer.rack];

    // Filter out staged letters from the rack display
    const availableTiles = rackCopy.filter(rackTile => {
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

    if (!selectedBoardPos || !playDirection || !gameState) return defaultEmptySlots;

    const slots: BoardSquare[] = [];
    let { x: currentX, y: currentY } = selectedBoardPos;

    // Based on direction, find the start of the word by backtracking over existing tiles
    if (playDirection === 'horizontal') {
      while (currentY > 0 && gameState.board[currentX][currentY - 1].tile) {
        currentY--;
      }
    } else { // vertical
      while (currentX > 0 && gameState.board[currentX - 1][currentY].tile) {
        currentX--;
      }
    }

    let emptySlotsCount = 0;

    // Now build forward to create the slots
    while (((playDirection === 'horizontal' && currentY < 15) || (playDirection === 'vertical' && currentX < 15)) && emptySlotsCount < MAX_EMPTY_SLOTS) {
      const boardSquare = gameState.board[currentX][currentY];
      slots.push(boardSquare);
      if (!boardSquare.tile) {
        emptySlotsCount++;
      }

      if (playDirection === 'horizontal') currentY++;
      else currentX++;
    }

    return slots;
  }, [selectedBoardPos, playDirection, gameState]);


  const tempPlacedTiles = useMemo((): PlacedTile[] => {
    if (!selectedBoardPos || !playDirection || !wordBuilderSlots.length) return [];

    const placed: PlacedTile[] = [];
    let tileIndex = 0;

    let { x: startX, y: startY } = selectedBoardPos;

    // Backtrack to the start of the word on the board
    if (playDirection === 'horizontal') {
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
      const currentX = playDirection === 'vertical' ? startX + i : startX;
      const currentY = playDirection === 'horizontal' ? startY + i : startY;

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
  }, [stagedTiles, wordBuilderSlots, playDirection, selectedBoardPos, gameState]);

  const performGameAction = async (
    action: (currentState: GameState) => GameState | Promise<GameState | null> | null,
    message?: string
  ): Promise<GameState | null> => {
    setIsLoading(true);
    try {
      const gameData = await getGameState(gameId);
      if (!gameData) {
        toast({ title: "Error", description: "Game not found. It might have been deleted.", variant: "destructive" });
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
      toast({ title: "Action Failed", description: e.message || "Could not perform the action. The game state may have changed. Please try again.", variant: 'destructive' });
      // Refetch to get latest state in case of conflict
      await fetchGame();
      return null;
    } finally {
      setIsLoading(false);
    }
  }


  const joinGame = async () => {
    if (!newPlayerName.trim() || !newPlayerCode.trim()) {
      toast({
        title: "Cannot Join Game",
        description: "Player name and code cannot be empty.",
        variant: 'destructive',
      })
      return;
    }

    const trimmedName = newPlayerName.trim();
    const trimmedCode = newPlayerCode.trim();

    const currentGameData = await getGameState(gameId);
    if (!currentGameData) return;

    const existingPlayerInGame = currentGameData.gameState.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());

    if (existingPlayerInGame) {
      if (existingPlayerInGame.code === trimmedCode) {
        handleAuth(existingPlayerInGame.id);
        toast({ title: "Welcome back!", description: `You have rejoined the game as ${existingPlayerInGame.name}.` });
        return;
      } else {
        toast({ title: "Cannot Join", description: "A player with that name already exists, but the code is incorrect.", variant: "destructive" });
        return;
      }
    }

    const action = (currentState: GameState) => {
      const numPlayers = currentState.players.length;
      if (numPlayers >= 4) {
        toast({ title: "Cannot Join Game", description: "Lobby is full (max 4 players).", variant: 'destructive' });
        return null;
      }
      const currentTurnsPlayed = currentState.history.length;
      const currentRoundsPlayed = Math.floor(currentTurnsPlayed / numPlayers);
      if (numPlayers > 1 && currentRoundsPlayed > 0 || numPlayers < 2 && currentTurnsPlayed > 1) {
        toast({ title: "Cannot Join Game", description: "The game has already started.", variant: 'destructive' });
        return null;
      }

      const currentTileBag = [...currentState.tileBag];
      const tilesToDraw = Math.min(7, currentTileBag.length);
      if (tilesToDraw < 7) {
        toast({ title: "Cannot Join Game", description: "Not enough tiles left in the bag to start.", variant: 'destructive' });
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
      const newPlayer = updatedGameState.players.find(p => p.name === trimmedName);
      if (newPlayer) {
        handleAuth(newPlayer.id);
        // Add gameId to local storage history after successful join
        const gameHistory = new Set(JSON.parse(localStorage.getItem(LocalStorageKey.GAMES) || '[]'));
        if (!gameHistory.has(gameId)) {
          gameHistory.add(gameId);
          localStorage.setItem(LocalStorageKey.GAMES, JSON.stringify(Array.from(gameHistory).sort()));
        }

      }
      setNewPlayerName('');
      setNewPlayerCode('');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleSquareClick = (x: number, y: number) => {
    if (selectedBoardPos?.x === x && selectedBoardPos?.y === y) {
      // Cycle through directions or deselect
      if (playDirection === 'horizontal') {
        setPlayDirection('vertical');
      } else if (playDirection === 'vertical') {
        setSelectedBoardPos(null);
        setPlayDirection(null);
        // As per TODO only clear staged tiles on reset
        // setStagedTiles([]); // Clear staged tiles on deselect
      }
    } else {
      // New selection
      setSelectedBoardPos({ x, y });
      setPlayDirection('horizontal');
      // As per TODO only clear staged tiles on reset
     //  setStagedTiles([]); // Clear staged tiles on new selection
    }
  };

  const handleRackTileClick = (tile: Tile) => {
    if (!gameState) return;

    // Determine how many tiles can still be placed
    const emptySlots = wordBuilderSlots.filter(s => s.tile === null).length;
    if (stagedTiles.length >= emptySlots || stagedTiles.length >= 7) {
      toast({ title: "Word Builder Full", description: "No more space to add tiles for this word.", variant: 'destructive' });
      return;
    }

    // Add the new tile to the staging area.
    // The `tempPlacedTiles` memo will calculate its correct (x, y) coordinates.
    setStagedTiles(prev => [...prev, { ...tile, x: -1, y: -1 }]); // Use placeholder coords
  };


  const handleStagedTileClick = (index: number) => {
    setStagedTiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetTurn = useCallback(() => {
    setStagedTiles([]);
    setSelectedBoardPos(null);
    setPlayDirection(null);
  }, []);

  const handlePlayWord = async () => {
    if (!gameState || !authenticatedPlayer) return;
    if (stagedTiles.length === 0) {
      toast({ title: "Cannot Play", description: "You haven't placed any tiles.", variant: 'destructive' });
      return;
    }

    // --- Placement and Word Calculation ---
    const { score, words: allWords } = calculateMoveScore(tempPlacedTiles, gameState.board);
    const mainWordInfo = allWords.find(w => w.direction === (playDirection || 'horizontal')) || allWords[0];

    if (!mainWordInfo || mainWordInfo.word.length < 2) {
      toast({ title: "Cannot Play", description: "A word must be at least 2 letters long.", variant: 'destructive' });
      return;
    }

    // --- Validation for placement ---
    const isFirstMove = gameState.history.length === 0;
    if (isFirstMove) {
      const coversCenter = tempPlacedTiles.some(t => t.x === 7 && t.y === 7);
      if (!coversCenter) {
        toast({
          title: "Invalid Placement",
          description: "The first word must cover the center star.",
          variant: "destructive",
        });
        return;
      }
    } else {
      const isConnected = tempPlacedTiles.some(tile => {
        const { x, y } = tile;
        const neighbors = [
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        ];
        return neighbors.some(n => {
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
      const validationPromises = allWords.map(wordInfo => verifyWordAction(wordInfo.word));
      const validationResults = await Promise.all(validationPromises);

      const invalidWordIndex = validationResults.findIndex(result => !result.isValid);

      if (invalidWordIndex > -1) {
        const invalidWord = allWords[invalidWordIndex].word;
        toast({ title: "Invalid Word", description: `The word "${invalidWord}" is not valid.`, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      // --- All words are valid, proceed with action ---
      const action = (currentState: GameState) => {
        const currentTurnPlayerIndex = currentState.history.length % currentState.players.length;
        const currentTurnPlayer = currentState.players[currentTurnPlayerIndex];

        if (currentTurnPlayer.id !== authenticatedPlayerId) {
          throw new Error(`It's not your turn. It's ${currentTurnPlayer.name}'s turn.`);
        }

        const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy

        const playerToUpdate = newGameState.players.find((p: Player) => p.id === authenticatedPlayerId)!;
        playerToUpdate.score += score;

        // Remove played tiles from rack and replenish from bag
        const tilesToDraw = tempPlacedTiles.length;
        const newTiles = newGameState.tileBag.slice(0, tilesToDraw);

        let rackAfterPlay = [...playerToUpdate.rack];
        const stagedLetters = stagedTiles.map(t => t.letter);

        stagedLetters.forEach(letter => {
          const indexToRemove = rackAfterPlay.findIndex(t => t.letter === letter);
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
          word: mainWordInfo.word,
          tiles: tempPlacedTiles, // Only store the tiles placed by the user this turn
          score: score,
        };

        newGameState.history.push(playedWord);

        resetTurn();
        toast({ title: "Valid Word!", description: `Scored ${score} points.` });
        return newGameState;
      };

      const message = `feat: ${authenticatedPlayer.name} played ${mainWordInfo.word} for ${score} points in game ${gameId}`;
      await performGameAction(action, message);

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: `Could not verify word.`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassTurn = async () => {
    if (!gameState || !authenticatedPlayer) return;

    const action = (currentState: GameState) => {
      const currentTurnPlayerIndex = currentState.history.length % currentState.players.length;
      const currentTurnPlayer = currentState.players[currentTurnPlayerIndex];

      if (currentTurnPlayer.id !== authenticatedPlayerId) {
        throw new Error(`It's not your turn. It's ${currentTurnPlayer.name}'s turn.`);
      }

      const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy

      // Add a "pass" event to history to advance the turn
      const passEvent: PlayedWord = {
        playerId: authenticatedPlayer.id,
        word: '',
        tiles: [],
        score: 0,
      };

      newGameState.history.push(passEvent);

      resetTurn();
      toast({ title: "Turn Passed" });
      return newGameState;
    };

    const message = `feat: ${authenticatedPlayer.name} passed their turn in game ${gameId}`;
    await performGameAction(action, message);
  };

  const handleAuth = (playerId: string) => {
    setAuthenticatedPlayerId(playerId);
    localStorage.setItem(`${LocalStorageKey.PLAYER_ID_}${gameId}`, playerId);
  }

  if (isLoading && !gameState) {
    return <div className="text-center p-10 flex items-center justify-center gap-2"><RefreshCw className="animate-spin h-5 w-5" /> Loading Game...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl text-center p-10">
        <Card className="shadow-xl border-destructive">
          <CardHeader>
            <div className="mx-auto bg-destructive text-destructive-foreground rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl text-destructive">Error Loading Game</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={() => fetchGame()}><RefreshCw className="mr-2 h-4 w-4" /> Try Again</Button>
              <Button variant="secondary" asChild>
                <Link href="/draw">
                  <KeyRound className="mr-2 h-4 w-4" /> Join Different Game
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!gameState) {
    return <div className="text-center p-10">Game not found.</div>;
  }

  // Show join screen if not authenticated
  if (!authenticatedPlayer) {
    return (
      <div className="container mx-auto max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Join Game</CardTitle>
            <CardDescription className="text-center">
              A game is in progress. Create your player to join.
            </CardDescription>
            <div className='text-center pt-4'>
              <p className="text-sm text-muted-foreground">Game Key</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <p className="text-4xl font-bold tracking-[0.3em] text-primary bg-muted px-4 py-2 rounded-lg">{gameId}</p>
                <Button variant="ghost" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
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
                  onChange={(e) => setNewPlayerName(e.target.value)}
                />
                <div className='relative'>
                  <Input
                    type={showCode ? 'text' : 'password'}
                    placeholder="Enter a secret code"
                    value={newPlayerCode}
                    onChange={(e) => setNewPlayerCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && joinGame()}
                  />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setShowCode(s => !s)}>
                    {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={joinGame} className="w-full" disabled={!newPlayerName.trim() || !newPlayerCode.trim() || !canJoinGame || isLoading}>
                {isLoading ? <RefreshCw className="animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                {existingPlayer ? "Rejoin Game" : "Join Game"}
              </Button>

              {!canJoinGame && !existingPlayer && <p className="text-center text-sm text-destructive">The game is full or too far along to join.</p>}

              <div className="space-y-2 pt-4">
                <h3 className="text-lg font-medium flex items-center"><Users className="mr-2 h-5 w-5" /> Players Already Joined ({gameState.players.length}/4)</h3>
                <div className="bg-muted/50 rounded-lg p-4 min-h-[50px] space-y-2">
                  {gameState.players.length > 0 ? gameState.players.map((p, i) => (
                    <div key={p.id} className="flex items-center bg-background p-2 rounded-md shadow-sm">
                      <span className="font-bold text-primary">{i + 1}.</span>
                      <span className="ml-2">{p.name}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center pt-2">No players have joined yet.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show auth dialog if we have a player ID but they need to enter a code (e.g. new device)
  if (!authenticatedPlayer && authenticatedPlayerId) {
    return <PlayerAuthDialog players={gameState.players.filter(p => p.id === authenticatedPlayerId)} onAuth={handleAuth} />
  }


  if (!currentPlayer) {
    return (
      <div className="container mx-auto max-w-2xl text-center p-10">
        <Card>
          <CardHeader>
            <CardTitle>Waiting for players...</CardTitle>
            <CardDescription>The game will begin when the first player makes a move.</CardDescription>
          </CardHeader>
          <CardContent>
            <GameBoard board={gameState.board} tempPlacedTiles={[]} onSquareClick={() => { }} selectedBoardPos={null} playDirection={null} />
            <div className="mt-4">
              {authenticatedPlayer && (
                <PlayerRack
                  rack={authenticatedPlayer.rack}
                  onTileSelect={() => { }}
                  isMyTurn={false}
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
          <GameBoard board={gameState.board} tempPlacedTiles={tempPlacedTiles} onSquareClick={handleSquareClick} selectedBoardPos={selectedBoardPos} playDirection={playDirection} />
        </div>
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {authenticatedPlayer && (
            (() => {
              const authenticatedPlayerIndex = gameState!.players.findIndex(p => p.id === authenticatedPlayerId);
              const playerColor = PLAYER_COLORS[authenticatedPlayerIndex % PLAYER_COLORS.length];
              return (
                <div className="lg:sticky lg:top-4 space-y-4">
                  <PlayerRack
                    rack={rackTiles}
                    onTileSelect={isMyTurn ? handleRackTileClick : () => { }}
                    isMyTurn={isMyTurn}
                    playerColor={playerColor}
                  />
                  {gameState && (
                    <WordBuilder
                      slots={wordBuilderSlots}
                      stagedTiles={stagedTiles}
                      onStagedTileClick={handleStagedTileClick}
                      board={gameState.board}
                      tempPlacedTiles={tempPlacedTiles}
                      playerColor={playerColor}
                      playDirection={playDirection}
                    />
                  )}
                </div>
              );
            })()
          )}
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              {!isMyTurn && <CardDescription>It's {currentPlayer.name}'s turn. {isPolling && <RefreshCw className="inline-block animate-spin h-4 w-4 ml-2" />}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={handlePlayWord} disabled={stagedTiles.length === 0 || !isMyTurn || isLoading} className="bg-accent hover:bg-accent/80 text-accent-foreground">
                {isLoading && !isPolling ? <RefreshCw className="animate-spin" /> : "Play Word"}
              </Button>
              <Button variant="outline" disabled={!isMyTurn || isLoading}>Swap Tiles</Button>
              <Button variant="outline" disabled={!isMyTurn || isLoading} onClick={handlePassTurn}>Pass Turn</Button>
              <Button variant="secondary" onClick={resetTurn} disabled={stagedTiles.length === 0 || !isMyTurn || isLoading}>Reset Turn</Button>
            </CardContent>
          </Card>
          <Scoreboard players={gameState.players} currentPlayerId={currentPlayer.id} />
        </div>
      </div>
    </div>
  );
}







