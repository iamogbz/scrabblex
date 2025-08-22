"use client";

import { useState, useEffect, useCallback } from 'react';
import type { GameState, Player, Tile, PlacedTile, BoardSquare } from '@/types';
import { TILE_BAG, createInitialBoard } from '@/lib/game-data';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserPlus, Play, Copy, Check, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GameBoard from './game-board';
import PlayerRack from './player-rack';
import Scoreboard from './scoreboard';
import { verifyWordAction } from '@/app/actions';

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
  const [newPlayerName, setNewPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedTile, setSelectedTile] = useState<{ tile: Tile; index: number } | null>(null);
  const [tempPlacedTiles, setTempPlacedTiles] = useState<PlacedTile[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    // Initialize game state for a new game
    setGameState({
      gameId,
      players: [],
      tileBag: shuffle(TILE_BAG),
      board: createInitialBoard(),
      currentPlayerIndex: 0,
      gamePhase: 'lobby',
    });
  }, [gameId]);

  const addPlayer = () => {
    if (!gameState || gameState.players.length >= 4 || !newPlayerName.trim()) {
      toast({
        title: "Cannot Add Player",
        description: !newPlayerName.trim() ? "Player name cannot be empty." : "Lobby is full (max 4 players).",
        variant: 'destructive',
      })
      return;
    }
    const newPlayer: Player = {
      id: `p${gameState.players.length + 1}`,
      name: newPlayerName.trim(),
      score: 0,
      rack: [],
    };
    setGameState({ ...gameState, players: [...gameState.players, newPlayer] });
    setNewPlayerName('');
  };

  const startGame = () => {
    if (!gameState || gameState.players.length < 1) {
       toast({
        title: "Cannot Start Game",
        description: "You need at least 1 player to start the game.",
        variant: 'destructive',
      })
      return;
    }

    // Deal 7 tiles to each player
    let currentTileBag = [...gameState.tileBag];
    const updatedPlayers = gameState.players.map(player => {
      const newTiles = currentTileBag.splice(0, 7);
      return { ...player, rack: newTiles };
    });

    setGameState({
      ...gameState,
      players: updatedPlayers,
      tileBag: currentTileBag,
      gamePhase: 'playing',
    });
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleTileSelect = (tile: Tile, index: number) => {
    if (selectedTile && selectedTile.index === index) {
      setSelectedTile(null); // Deselect
    } else {
      setSelectedTile({ tile, index });
    }
  };

  const handleSquareClick = (x: number, y: number) => {
    if (!selectedTile || !gameState) return;

    // Prevent placing on an already occupied square
    if (gameState.board[x][y].tile || tempPlacedTiles.some(t => t.x === x && t.y === y)) {
      return;
    }
    
    // Add to temp placement
    const newPlacedTile: PlacedTile = { ...selectedTile.tile, x, y };
    setTempPlacedTiles([...tempPlacedTiles, newPlacedTile]);

    // Remove from player's rack (visually)
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const newRack = [...currentPlayer.rack];
    newRack.splice(selectedTile.index, 1);
    
    const updatedPlayers = [...gameState.players];
    updatedPlayers[gameState.currentPlayerIndex] = { ...currentPlayer, rack: newRack };

    setGameState({ ...gameState, players: updatedPlayers });
    setSelectedTile(null);
  };
  
  const handlePlayWord = async () => {
    if (tempPlacedTiles.length === 0 || !gameState) return;
  
    // This is a simplified word formation logic
    const word = tempPlacedTiles.sort((a,b) => a.x === b.x ? a.y - b.y : a.x - b.x).map(t => t.letter).join('');
    
    try {
      const result = await verifyWordAction({ word });

      if(result.isValid) {
        toast({ title: "Valid Word!", description: `"${word}" is a valid word.` });
        // Simplified scoring
        const points = tempPlacedTiles.reduce((sum, tile) => sum + tile.points, 0);
        
        const updatedPlayers = [...gameState.players];
        const currentPlayer = updatedPlayers[gameState.currentPlayerIndex];
        currentPlayer.score += points;

        // Draw new tiles
        const tilesToDraw = 7 - currentPlayer.rack.length;
        const newTiles = gameState.tileBag.slice(0, tilesToDraw);
        currentPlayer.rack.push(...newTiles);
        
        const newBoard = gameState.board.map(row => row.map(sq => ({...sq})));
        tempPlacedTiles.forEach(tile => {
            newBoard[tile.x][tile.y].tile = tile;
        });

        setGameState({
            ...gameState,
            board: newBoard,
            players: updatedPlayers,
            tileBag: gameState.tileBag.slice(tilesToDraw),
            currentPlayerIndex: (gameState.currentPlayerIndex + 1) % gameState.players.length
        });
        setTempPlacedTiles([]);

      } else {
        toast({ title: "Invalid Word", description: `"${word}" is not a valid word.`, variant: 'destructive' });
        // Return tiles to rack
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const returnedTiles = tempPlacedTiles.map(({letter, points}) => ({letter, points}));
        currentPlayer.rack.push(...returnedTiles);
        
        const updatedPlayers = [...gameState.players];
        updatedPlayers[gameState.currentPlayerIndex] = currentPlayer;

        setGameState({...gameState, players: updatedPlayers});
        setTempPlacedTiles([]);
      }
    } catch(e) {
        toast({ title: "Error", description: `Could not verify word.`, variant: 'destructive' });
    }
  };

  if (!gameState) {
    return <div className="text-center p-10">Loading Game...</div>;
  }
  
  if (gameState.gamePhase === 'lobby') {
    return (
      <div className="container mx-auto max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Game Lobby</CardTitle>
            <CardDescription className="text-center">Share the game key with your friends to let them join.</CardDescription>
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
               <div className="flex space-x-2">
                 <Input 
                    placeholder="Enter your name" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                 />
                 <Button onClick={addPlayer} disabled={!newPlayerName.trim()}><UserPlus className="h-4 w-4 mr-2"/> Add Player</Button>
               </div>
               
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

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

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
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button onClick={handlePlayWord} disabled={tempPlacedTiles.length === 0} className="bg-accent hover:bg-accent/80 text-accent-foreground">Play Word</Button>
              <Button variant="outline">Swap Tiles</Button>
              <Button variant="outline">Pass Turn</Button>
              <Button variant="secondary" onClick={() => setTempPlacedTiles([])}>Reset Turn</Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4">
        <PlayerRack 
          rack={currentPlayer.rack}
          onTileSelect={handleTileSelect}
          selectedTileIndex={selectedTile?.index ?? null}
        />
      </div>
    </div>
  );
}
