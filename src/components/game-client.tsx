
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GameState, Player, Tile, PlacedTile, PlayedWord } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserPlus, Play, Copy, Check, Users, RefreshCw, AlertTriangle, KeyRound, EyeOff, Eye, ArrowDown, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GameBoard from './game-board';
import PlayerRack from './player-rack';
import Scoreboard from './scoreboard';
import { getGameState, updateGameState, verifyWordAction } from '@/app/actions';
import Link from 'next/link';
import { PlayerAuthDialog } from './player-auth-dialog';
import WordBuilder from './word-builder';

export default function GameClient({ gameId }: { gameId: string }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerCode, setNewPlayerCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [stagedTiles, setStagedTiles] = useState<PlacedTile[]>([]);
  const [selectedBoardPos, setSelectedBoardPos] = useState<{x: number, y: number} | null>(null);
  const [playDirection, setPlayDirection] = useState<'horizontal' | 'vertical' | null>(null);

  const [authenticatedPlayerId, setAuthenticatedPlayerId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const fetchGame = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const gameData = await getGameState(gameId);
      if (gameData) {
        setGameState(gameData.gameState);
        setSha(gameData.sha);
      } else {
        setError(`Game with ID "${gameId}" not found. Check the key or create a new game.`);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load game data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  useEffect(() => {
    const storedPlayerId = localStorage.getItem(`scrabblex_player_id_${gameId}`);
    if (storedPlayerId) {
        // We will validate this against the game state once it loads.
        setAuthenticatedPlayerId(storedPlayerId);
    }
  }, [gameId]);
  
  useEffect(() => {
    if (gameState && authenticatedPlayerId) {
      // If a stored player ID is not actually in the game, clear it.
      if (!gameState.players.some(p => p.id === authenticatedPlayerId)) {
        setAuthenticatedPlayerId(null);
        localStorage.removeItem(`scrabblex_player_id_${gameId}`);
      }
    }
  }, [gameState, authenticatedPlayerId, gameId]);

  const turnsPlayed = useMemo(() => gameState?.history?.length ?? 0, [gameState]);
  
  const currentPlayer = useMemo(() => {
    if (!gameState || gameState.players.length === 0) return null;
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
    
    const stagedLetters = stagedTiles.map(t => t.letter);
    const rackCopy = [...authenticatedPlayer.rack];

    // Filter out staged letters from the rack display
    const availableTiles = rackCopy.filter(rackTile => {
      const index = stagedLetters.indexOf(rackTile.letter);
      if (index > -1) {
        stagedLetters.splice(index, 1);
        return false;
      }
      return true;
    });

    return availableTiles;
  }, [authenticatedPlayer, stagedTiles]);

  const wordBuilderSlots = useMemo((): (PlacedTile | null)[] => {
    if (!selectedBoardPos || !playDirection || !gameState || !authenticatedPlayer) return [];

    const slots: (PlacedTile | null)[] = [];
    const { x: startX, y: startY } = selectedBoardPos;
    let currentX = startX;
    let currentY = startY;

    // Go backwards to find the true start of the potential word
    while (currentX >= 0 && currentY >= 0 && gameState.board[currentX][currentY].tile) {
      if (playDirection === 'horizontal') currentY--;
      else currentX--;
    }
    if (playDirection === 'horizontal') currentY++;
    else currentX++;

    const startOfWordX = currentX;
    const startOfWordY = currentY;

    let tilesToPlaceCount = authenticatedPlayer.rack.length;
    let currentSlotX = startOfWordX;
    let currentSlotY = startOfWordY;

    while (slots.length < 7 && currentSlotX < 15 && currentSlotY < 15) {
        const boardSquare = gameState.board[currentSlotX][currentSlotY];
        if (boardSquare.tile) {
            slots.push(boardSquare.tile);
        } else {
            if (tilesToPlaceCount > 0) {
                slots.push(null); // Empty, fillable slot
                tilesToPlaceCount--;
            } else {
                break; // No more tiles to place
            }
        }
        
        if (playDirection === 'horizontal') currentSlotY++;
        else currentSlotX++;
    }

    return slots;
  }, [selectedBoardPos, playDirection, gameState, authenticatedPlayer]);

  const tempPlacedTiles = useMemo((): PlacedTile[] => {
    if (!selectedBoardPos || !playDirection || !wordBuilderSlots.length) return [];
    
    // Convert staged tiles to board-relative temporary tiles
    const placed: PlacedTile[] = [];
    let rackTileIndex = 0;

    wordBuilderSlots.forEach((slot, index) => {
        if (slot === null && rackTileIndex < stagedTiles.length) {
            const tile = stagedTiles[rackTileIndex];
            const { x: startX, y: startY } = selectedBoardPos;
            
            let currentX = startX;
            let currentY = startY;
             // This logic needs to find the actual coordinates of the slot
            if (playDirection === 'horizontal') currentY = startY + index;
            else currentX = startX + index;
            
            // This is still not quite right. We need to map builder slot index to board coordinates
            let wordX = wordBuilderSlots[0]?.x ?? startX;
            let wordY = wordBuilderSlots[0]?.y ?? startY;

            if (playDirection === 'horizontal') {
                wordY += index;
            } else {
                wordX += index;
            }

            placed.push({ ...tile, x: wordX, y: wordY });
            rackTileIndex++;
        }
    });

    return placed;
  }, [stagedTiles, wordBuilderSlots, playDirection, selectedBoardPos]);

  const performGameAction = async (action: (currentState: GameState) => GameState | Promise<GameState | null> | null): Promise<GameState | null> => {
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
             await updateGameState(gameId, newGameState, gameData.sha);
             // After successful update, refetch to get new SHA and confirm state
            await fetchGame();
            return newGameState;
        }
        return null;
    } catch (e: any) {
        console.error(e);
        toast({ title: "Action Failed", description: e.message || "Could not perform the action. The game state may have changed. Please try again.", variant: 'destructive'});
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
        toast({ title: "Cannot Join", description: "A player with that name already exists, but the code is incorrect.", variant: "destructive"});
        return;
      }
    }

    const updatedGameState = await performGameAction((currentState) => {
      const currentTurnsPlayed = currentState.history.length;
      if (currentState.players.length >= 4) {
        toast({ title: "Cannot Join Game", description: "Lobby is full (max 4 players).", variant: 'destructive' });
        return null;
      }
      if (currentState.players.length > 0 && currentTurnsPlayed >= currentState.players.length) {
        toast({ title: "Cannot Join Game", description: "The game is too far along to join.", variant: 'destructive' });
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
    });

    if (updatedGameState) {
        const newPlayer = updatedGameState.players.find(p => p.name === trimmedName);
        if (newPlayer) {
          handleAuth(newPlayer.id);
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
    if (!isMyTurn) return;

    if (selectedBoardPos?.x === x && selectedBoardPos?.y === y) {
        // Cycle through directions or deselect
        if (playDirection === 'horizontal') {
            setPlayDirection('vertical');
        } else if (playDirection === 'vertical') {
            setSelectedBoardPos(null);
            setPlayDirection(null);
            setStagedTiles([]); // Clear staged tiles on deselect
        }
    } else {
        // New selection
        setSelectedBoardPos({ x, y });
        setPlayDirection('horizontal');
        setStagedTiles([]); // Clear staged tiles on new selection
    }
  };
  
  const handleRackTileClick = (tile: Tile) => {
    if (!isMyTurn || !selectedBoardPos || stagedTiles.length >= 7) return;

    const emptySlots = wordBuilderSlots.filter(s => s === null).length;
    if (stagedTiles.length < emptySlots) {
        setStagedTiles(prev => [...prev, { ...tile, x: 0, y: 0 }]); // x,y are placeholders
    } else {
        toast({ title: "Word Builder Full", description: "No more space to add tiles for this word.", variant: 'destructive' });
    }
  };

  const handleStagedTileClick = (index: number) => {
    setStagedTiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const resetTurn = useCallback(async () => {
    await fetchGame(); 
    setStagedTiles([]);
    setSelectedBoardPos(null);
    setPlayDirection(null);
  }, [fetchGame]);

  const handlePlayWord = async () => {
    if (stagedTiles.length === 0) return;
  
    // Construct word from the builder slots, not just staged tiles
    const word = wordBuilderSlots
      .map((slot, index) => {
        if (slot) return slot.letter;
        const stagedTile = stagedTiles.find((_, i) => {
            // This is tricky - need to map builder slot to staged tile
            // Assuming stagedTiles are in order of placement
            let placedCount = 0;
            for(let j = 0; j < index; j++) {
                if(wordBuilderSlots[j] === null) placedCount++;
            }
            return i === placedCount;
        });
        return stagedTile?.letter;
      })
      .join('');

    if (!word) {
        toast({ title: "Cannot Play", description: "The word is empty.", variant: 'destructive'});
        return;
    }
    
    setIsLoading(true);
    try {
      const result = await verifyWordAction({ word });

      if(result.isValid) {
        
        await performGameAction((currentState) => {
            const currentTurnPlayerIndex = currentState.history.length % currentState.players.length;
            const currentTurnPlayer = currentState.players[currentTurnPlayerIndex];

            if (currentTurnPlayer.id !== authenticatedPlayerId) {
                throw new Error(`It's not your turn. It's ${currentTurnPlayer.name}'s turn.`);
            }

            const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy
            
            const currentPlayer = newGameState.players.find((p: Player) => p.id === authenticatedPlayerId)!;
            const points = tempPlacedTiles.reduce((sum, tile) => sum + tile.points, 0); // Recalculate points based on final tile placement
            currentPlayer.score += points;

            const tilesToDraw = tempPlacedTiles.length;
            const newTiles = newGameState.tileBag.slice(0, tilesToDraw);
            
            // This needs to correctly remove tiles from the rack
            let rackAfterPlay = [...currentPlayer.rack];
            const stagedLetters = stagedTiles.map(t => t.letter);

            stagedLetters.forEach(letter => {
                const indexToRemove = rackAfterPlay.findIndex(t => t.letter === letter);
                if (indexToRemove > -1) {
                    rackAfterPlay.splice(indexToRemove, 1);
                }
            });

            rackAfterPlay.push(...newTiles);
            currentPlayer.rack = rackAfterPlay;

            newGameState.tileBag.splice(0, tilesToDraw);
            
            tempPlacedTiles.forEach(tile => {
                newGameState.board[tile.x][tile.y].tile = {letter: tile.letter, points: tile.points, x: tile.x, y: tile.y};
            });

            const playedWord: PlayedWord = {
              playerId: currentPlayer.id,
              word: word,
              tiles: tempPlacedTiles,
            }
            newGameState.history.push(playedWord);
            
            setStagedTiles([]);
            setSelectedBoardPos(null);
            setPlayDirection(null);
            toast({ title: "Valid Word!", description: `"${word}" is a valid word.` });
            return newGameState;
        });

      } else {
        toast({ title: "Invalid Word", description: `"${word}" is not a valid word.`, variant: 'destructive' });
      }
    } catch(e) {
        toast({ title: "Error", description: `Could not verify word.`, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleAuth = (playerId: string) => {
    setAuthenticatedPlayerId(playerId);
    localStorage.setItem(`scrabblex_player_id_${gameId}`, playerId);
  }

  if (isLoading && !gameState) {
    return <div className="text-center p-10 flex items-center justify-center gap-2"><RefreshCw className="animate-spin h-5 w-5"/> Loading Game...</div>;
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
                    <Button onClick={fetchGame}><RefreshCw className="mr-2 h-4 w-4"/> Try Again</Button>
                    <Button variant="secondary" asChild>
                        <Link href="/draw">
                            <KeyRound className="mr-2 h-4 w-4"/> Join Different Game
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
                        {showCode ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                      </Button>
                  </div>
                </div>
                <Button onClick={joinGame} className="w-full" disabled={!newPlayerName.trim() || !newPlayerCode.trim() || !canJoinGame || isLoading}>
                    {isLoading ? <RefreshCw className="animate-spin" /> : <UserPlus className="h-4 w-4 mr-2"/>}
                    {existingPlayer ? "Rejoin Game" : "Join Game"}
                </Button>

                {!canJoinGame && !existingPlayer && <p className="text-center text-sm text-destructive">The game is full or too far along to join.</p>}
               
                <div className="space-y-2 pt-4">
                    <h3 className="text-lg font-medium flex items-center"><Users className="mr-2 h-5 w-5"/> Players Already Joined ({gameState.players.length}/4)</h3>
                    <div className="bg-muted/50 rounded-lg p-4 min-h-[50px] space-y-2">
                        {gameState.players.length > 0 ? gameState.players.map((p, i) => (
                        <div key={p.id} className="flex items-center bg-background p-2 rounded-md shadow-sm">
                            <span className="font-bold text-primary">{i+1}.</span>
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
                    <GameBoard board={gameState.board} tempPlacedTiles={[]} onSquareClick={()=>{}} selectedBoardPos={null} playDirection={null}/>
                    <div className="mt-4">
                        {authenticatedPlayer && (
                            <PlayerRack 
                                rack={authenticatedPlayer.rack}
                                onTileSelect={()=>{}}
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
          <GameBoard board={gameState.board} tempPlacedTiles={tempPlacedTiles} onSquareClick={handleSquareClick} selectedBoardPos={selectedBoardPos} playDirection={playDirection}/>
        </div>
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {authenticatedPlayer && (
            <div className="lg:sticky lg:top-4 space-y-4">
              <PlayerRack 
                  rack={rackTiles}
                  onTileSelect={isMyTurn ? handleRackTileClick : ()=>{}}
                  isMyTurn={isMyTurn}
              />
              {selectedBoardPos && isMyTurn && (
                <WordBuilder
                    slots={wordBuilderSlots}
                    stagedTiles={stagedTiles}
                    onStagedTileClick={handleStagedTileClick}
                />
              )}
            </div>
          )}
          <Scoreboard players={gameState.players} currentPlayerId={currentPlayer.id} />
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              {!isMyTurn && <CardDescription>It's {currentPlayer.name}'s turn.</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={handlePlayWord} disabled={stagedTiles.length === 0 || !isMyTurn || isLoading} className="bg-accent hover:bg-accent/80 text-accent-foreground">
                {isLoading ? <RefreshCw className="animate-spin" /> : "Play Word"}
              </Button>
              <Button variant="outline" disabled={!isMyTurn || isLoading}>Swap Tiles</Button>
              <Button variant="outline" disabled={!isMyTurn || isLoading}>Pass Turn</Button>
              <Button variant="secondary" onClick={resetTurn} disabled={stagedTiles.length === 0 || !isMyTurn || isLoading}>Reset Turn</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
