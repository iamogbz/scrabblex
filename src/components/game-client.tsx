
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GameState, Player, Tile, PlacedTile, PlayedWord } from '@/types';
import { TILE_BAG } from '@/lib/game-data';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserPlus, Play, Copy, Check, Users, RefreshCw, AlertTriangle, KeyRound, EyeOff, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GameBoard from './game-board';
import PlayerRack from './player-rack';
import Scoreboard from './scoreboard';
import { getGameState, updateGameState, verifyWordAction } from '@/app/actions';
import Link from 'next/link';
import { PlayerAuthDialog } from './player-auth-dialog';

// Utility to shuffle an array
const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function GameClient({ gameId }: { gameId: string }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerCode, setNewPlayerCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTile, setSelectedTile] = useState<{ tile: Tile; index: number } | null>(null);
  const [tempPlacedTiles, setTempPlacedTiles] = useState<PlacedTile[]>([]);
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

  const turnsPlayed = useMemo(() => gameState?.history?.length ?? 0, [gameState]);

  const currentPlayer = useMemo(() => {
    if (!gameState || gameState.players.length === 0) return null;
    const playerIndex = turnsPlayed % gameState.players.length;
    return gameState.players[playerIndex];
  }, [gameState, turnsPlayed]);

  const canJoinGame = useMemo(() => {
    if (!gameState) return false;
    if (gameState.players.length >= 4) return false;
    if (gameState.gamePhase === 'lobby') return true;
    if (gameState.gamePhase === 'playing') {
      return turnsPlayed < gameState.players.length;
    }
    return false;
  }, [gameState, turnsPlayed]);

  useEffect(() => {
    if (gameState?.gamePhase !== 'lobby') {
      const storedPlayerId = localStorage.getItem(`scrabblex_player_id_${gameId}`);
      if (storedPlayerId && gameState.players.some(p => p.id === storedPlayerId)) {
        setAuthenticatedPlayerId(storedPlayerId);
      }
    }
  }, [gameState, gameId]);
  
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

    const updatedGameState = await performGameAction((currentState) => {
      if (currentState.players.length >= 4) {
        toast({
            title: "Cannot Join Game",
            description: "Lobby is full (max 4 players).",
            variant: 'destructive',
        });
        return null;
      }
      
      if (currentState.gamePhase === 'playing' && (currentState.history.length >= currentState.players.length)) {
        toast({
            title: "Cannot Join Game",
            description: "The game is too far along to join.",
            variant: 'destructive',
        });
        return null;
      }

      if (currentState.players.some(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
        toast({
            title: "Cannot Join Game",
            description: "A player with that name already exists.",
            variant: 'destructive',
        });
        return null;
      }
      
      const newPlayer: Player = {
        id: `p${Date.now()}`,
        name: newPlayerName.trim(),
        score: 0,
        rack: [],
        code: newPlayerCode.trim(),
      };
      
      if(currentState.gamePhase === 'playing') {
        const tilesToDraw = 7;
        const currentTileBag = [...currentState.tileBag];
        if(currentTileBag.length < tilesToDraw) {
            toast({ title: "Cannot Join Game", description: "Not enough tiles left in the bag.", variant: 'destructive' });
            return null;
        }
        const newTiles = currentTileBag.splice(0, tilesToDraw);
        newPlayer.rack = newTiles;
        currentState.tileBag = currentTileBag;
      }
      
      return { ...currentState, players: [...currentState.players, newPlayer] };
    });

    if (updatedGameState) {
        const newPlayer = updatedGameState.players.find(p => p.name === newPlayerName.trim());
        if (newPlayer) {
          handleAuth(newPlayer.id);
        }
        setNewPlayerName('');
        setNewPlayerCode('');
    }
  };

  const startGame = async () => {
     await performGameAction((currentState) => {
        if (currentState.players.length < 1) {
            toast({
                title: "Cannot Start Game",
                description: "You need at least 1 player to start the game.",
                variant: 'destructive',
            })
            return null;
        }
        
        if (currentState.gamePhase === 'playing') {
            toast({ title: "Game Already Started", description: "The game is already in progress.", variant: 'destructive'});
            return null;
        }

        let currentTileBag = shuffle(TILE_BAG);
        const updatedPlayers = currentState.players.map(player => {
            const newTiles = currentTileBag.splice(0, 7);
            return { ...player, rack: newTiles };
        });

        return {
            ...currentState,
            players: updatedPlayers,
            tileBag: currentTileBag,
            gamePhase: 'playing' as const,
        };
    });
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleTileSelect = (tile: Tile, index: number) => {
    if (selectedTile && selectedTile.index === index) {
      setSelectedTile(null);
    } else {
      setSelectedTile({ tile, index });
    }
  };

  const handleSquareClick = (x: number, y: number) => {
    if (!selectedTile || !gameState) return;

    if (gameState.board[x][y].tile || tempPlacedTiles.some(t => t.x === x && t.y === y)) {
      return;
    }
    
    // Remove tile from rack visually
    const currentPlayer = gameState.players.find(p => p.id === authenticatedPlayerId);
    if (!currentPlayer) return;

    const newRack = [...currentPlayer.rack];
    const tileToRemove = newRack.splice(selectedTile.index, 1)[0];
    
    const newPlacedTile: PlacedTile = { ...tileToRemove, x, y };
    setTempPlacedTiles([...tempPlacedTiles, newPlacedTile]);

    // Update game state locally for immediate feedback
    setGameState(prev => {
      if (!prev) return null;
      const newPlayers = prev.players.map(p => p.id === authenticatedPlayerId ? {...p, rack: newRack} : p);
      return {...prev, players: newPlayers};
    });
    
    setSelectedTile(null);
  };
  
  const resetTurn = useCallback(async () => {
    await fetchGame(); // Refetch the original state from server to discard local changes
    setTempPlacedTiles([]);
    setSelectedTile(null);
  }, [fetchGame]);

  const handlePlayWord = async () => {
    if (tempPlacedTiles.length === 0) return;
  
    const word = tempPlacedTiles.sort((a,b) => a.x === b.x ? a.y - b.y : a.x - b.x).map(t => t.letter).join('');
    
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
            
            const currentPlayer = newGameState.players[currentTurnPlayerIndex];
            const points = tempPlacedTiles.reduce((sum, tile) => sum + tile.points, 0); // Recalculate points based on final tile placement
            currentPlayer.score += points;

            const tilesToDraw = tempPlacedTiles.length;
            const newTiles = newGameState.tileBag.slice(0, tilesToDraw);
            const currentRack = newGameState.players.find(p => p.id === authenticatedPlayerId)!.rack;
            
            // Remove played tiles from rack definition before adding new ones
            const playedLetters = tempPlacedTiles.map(t => t.letter);
            const rackAfterPlay = currentRack.filter(t => !playedLetters.includes(t.letter));

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
            
            setTempPlacedTiles([]);
            toast({ title: "Valid Word!", description: `"${word}" is a valid word.` });
            return newGameState;
        });

      } else {
        toast({ title: "Invalid Word", description: `"${word}" is not a valid word.`, variant: 'destructive' });
        resetTurn();
      }
    } catch(e) {
        toast({ title: "Error", description: `Could not verify word.`, variant: 'destructive' });
        resetTurn();
    } finally {
        setIsLoading(false);
    }
  };

  const handleAuth = (playerId: string) => {
    setAuthenticatedPlayerId(playerId);
    localStorage.setItem(`scrabblex_player_id_${gameId}`, playerId);
  }

  if (isLoading) {
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
  
  if (gameState.gamePhase === 'lobby' || (gameState.gamePhase === 'playing' && canJoinGame)) {
    // If the user is already a player, they should not see the join screen again.
    const isAlreadyPlayer = authenticatedPlayerId && gameState.players.some(p => p.id === authenticatedPlayerId);

    if (isAlreadyPlayer) {
      return (
        <div className="container mx-auto max-w-2xl">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-center">Game Lobby</CardTitle>
              <CardDescription className="text-center">Waiting for the game to start...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h3 className="text-lg font-medium flex items-center"><Users className="mr-2 h-5 w-5"/> Players ({gameState.players.length}/4)</h3>
                <div className="bg-muted/50 rounded-lg p-4 min-h-[100px] space-y-2">
                  {gameState.players.map((p, i) => (
                    <div key={p.id} className="flex items-center bg-background p-2 rounded-md shadow-sm">
                      <span className="font-bold text-primary">{i+1}.</span>
                      <span className="ml-2">{p.name} {p.id === authenticatedPlayerId && "(You)"}</span>
                    </div>
                  ))}
                </div>
              </div>
              {gameState.gamePhase === 'lobby' && (
                  <Button size="lg" className="w-full text-lg py-7 bg-accent hover:bg-accent/90 mt-4" onClick={startGame} disabled={gameState.players.length < 1}>
                      <Play className="h-6 w-6 mr-2" /> Start Game
                  </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return (
      <div className="container mx-auto max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Join Game</CardTitle>
            <CardDescription className="text-center">
                {gameState.gamePhase === 'lobby'
                ? "Create your player to join the lobby."
                : "A game is in progress, but you can still join!"}
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
                <Button onClick={joinGame} className="w-full" disabled={!newPlayerName.trim() || !newPlayerCode.trim() || !canJoinGame}>
                  <UserPlus className="h-4 w-4 mr-2"/> Join Game
                </Button>

                {!canJoinGame && <p className="text-center text-sm text-destructive">The game is full or too far along to join.</p>}
               
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

  if ((gameState.gamePhase === 'playing' || gameState.gamePhase === 'ended') && !authenticatedPlayerId) {
    return <PlayerAuthDialog players={gameState.players} onAuth={handleAuth} />
  }

  const authenticatedPlayer = gameState.players.find(p => p.id === authenticatedPlayerId);
  const isMyTurn = authenticatedPlayerId === currentPlayer?.id;

  if (!currentPlayer) {
     return <div className="text-center p-10">Error: Could not determine the current player.</div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-grow">
          <GameBoard board={gameState.board} tempPlacedTiles={tempPlacedTiles} onSquareClick={handleSquareClick} selectedTile={selectedTile} />
        </div>
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <Scoreboard players={gameState.players} currentPlayerId={currentPlayer.id} />
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              {!isMyTurn && <CardDescription>It's {currentPlayer.name}'s turn.</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={handlePlayWord} disabled={tempPlacedTiles.length === 0 || !isMyTurn} className="bg-accent hover:bg-accent/80 text-accent-foreground">Play Word</Button>
              <Button variant="outline" disabled={!isMyTurn}>Swap Tiles</Button>
              <Button variant="outline" disabled={!isMyTurn}>Pass Turn</Button>
              <Button variant="secondary" onClick={resetTurn} disabled={tempPlacedTiles.length === 0 || !isMyTurn}>Reset Turn</Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4">
        {authenticatedPlayer && (
            <PlayerRack 
                rack={authenticatedPlayer.rack}
                onTileSelect={isMyTurn ? handleTileSelect : ()=>{}}
                selectedTileIndex={selectedTile?.index ?? null}
                isMyTurn={isMyTurn}
            />
        )}
      </div>
    </div>
  );
}
