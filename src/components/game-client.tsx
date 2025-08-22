
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { GameState, Player, Tile, PlacedTile } from '@/types';
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

  useEffect(() => {
    if (gameState?.gamePhase === 'playing') {
      const storedPlayerId = localStorage.getItem(`scrabblex_player_id_${gameId}`);
      if (storedPlayerId && gameState.players.some(p => p.id === storedPlayerId)) {
        setAuthenticatedPlayerId(storedPlayerId);
      }
    }
  }, [gameState, gameId]);
  
  const performGameAction = async (action: (currentState: GameState) => GameState | Promise<GameState | null> | null) => {
    setIsLoading(true);
    try {
        const gameData = await getGameState(gameId);
        if (!gameData) {
            toast({ title: "Error", description: "Game not found. It might have been deleted.", variant: "destructive" });
            setError(`Game with ID "${gameId}" not found.`);
            return;
        }

        const newGameState = await action(gameData.gameState);
        
        if (newGameState) {
             await updateGameState(gameId, newGameState, gameData.sha);
             // After successful update, refetch to get new SHA and confirm state
            await fetchGame();
        }
    } catch (e) {
        console.error(e);
        toast({ title: "Action Failed", description: "Could not perform the action. The game state may have changed. Please try again.", variant: 'destructive'});
        // Refetch to get latest state in case of conflict
        await fetchGame();
    } finally {
        setIsLoading(false);
    }
  }


  const addPlayer = async () => {
    if (!newPlayerName.trim() || !newPlayerCode.trim()) {
      toast({
        title: "Cannot Add Player",
        description: "Player name and code cannot be empty.",
        variant: 'destructive',
      })
      return;
    }

    await performGameAction((currentState) => {
      if (currentState.players.length >= 4) {
        toast({
            title: "Cannot Add Player",
            description: "Lobby is full (max 4 players).",
            variant: 'destructive',
        });
        return null;
      }
      
      if (currentState.players.some(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
        toast({
            title: "Cannot Add Player",
            description: "A player with that name already exists.",
            variant: 'destructive',
        });
        return null;
      }

      const newPlayer: Player = {
        id: `p${currentState.players.length + 1}`,
        name: newPlayerName.trim(),
        score: 0,
        rack: [],
        code: newPlayerCode.trim(),
      };
      setNewPlayerName('');
      setNewPlayerCode('');
      return { ...currentState, players: [...currentState.players, newPlayer] };
    });
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
        toast({ title: "Valid Word!", description: `"${word}" is a valid word.` });
        
        await performGameAction((currentState) => {
            const newGameState = JSON.parse(JSON.stringify(currentState)); // Deep copy
            
            const currentPlayer = newGameState.players[newGameState.currentPlayerIndex];
            const points = tempPlacedTiles.reduce((sum, tile) => sum + tile.points, 0); // Recalculate points based on final tile placement
            currentPlayer.score += points;

            const tilesToDraw = tempPlacedTiles.length;
            const newTiles = newGameState.tileBag.slice(0, tilesToDraw);
            const currentRack = newGameState.players.find(p => p.id === authenticatedPlayerId)!.rack;
            
            currentRack.push(...newTiles);

            newGameState.tileBag.splice(0, tilesToDraw);
            
            tempPlacedTiles.forEach(tile => {
                newGameState.board[tile.x][tile.y].tile = {letter: tile.letter, points: tile.points, x: tile.x, y: tile.y};
            });

            newGameState.currentPlayerIndex = (newGameState.currentPlayerIndex + 1) % newGameState.players.length;
            
            setTempPlacedTiles([]);
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
  
  if (gameState.gamePhase === 'lobby') {
    return (
      <div className="container mx-auto max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Game Lobby</CardTitle>
            <CardDescription className="text-center">Share this page with your friends to let them join.</CardDescription>
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
                      onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                    />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setShowCode(s => !s)}>
                      {showCode ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </Button>
                 </div>
               </div>
                <Button onClick={addPlayer} disabled={!newPlayerName.trim() || !newPlayerCode.trim() || gameState.players.length >= 4}><UserPlus className="h-4 w-4 mr-2"/> Add Player</Button>
               
               <div className="space-y-2">
                  <h3 className="text-lg font-medium flex items-center"><Users className="mr-2 h-5 w-5"/> Players ({gameState.players.length}/4)</h3>
                  <div className="bg-muted/50 rounded-lg p-4 min-h-[100px] space-y-2">
                    {gameState.players.length > 0 ? gameState.players.map((p, i) => (
                      <div key={p.id} className="flex items-center bg-background p-2 rounded-md shadow-sm">
                        <span className="font-bold text-primary">{i+1}.</span>
                        <span className="ml-2">{p.name}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center pt-5">Waiting for players to join...</p>}
                  </div>
               </div>

               <Button size="lg" className="w-full text-lg py-7 bg-accent hover:bg-accent/90" onClick={startGame} disabled={gameState.players.length < 1}>
                 <Play className="h-6 w-6 mr-2" /> Start Game
               </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameState.gamePhase === 'playing' && !authenticatedPlayerId) {
    return <PlayerAuthDialog players={gameState.players} onAuth={handleAuth} />
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const authenticatedPlayer = gameState.players.find(p => p.id === authenticatedPlayerId);
  const isMyTurn = authenticatedPlayerId === currentPlayer.id;

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
