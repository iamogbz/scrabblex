import type { Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { Award, Bot, History, User } from "lucide-react";
import { Button } from "./ui/button";

interface ScoreboardProps {
  players: Player[];
  currentPlayerId: string;
  authenticatedPlayerId: string | null;
  isGameOver?: boolean;
  onReplacePlayer: (playerId: string) => void;
  lastMoveTimestamp?: string;
  onShowHistory: () => void;
  gameHistoryLength: number;
  gameCreatedAt?: string;
}

export default function Scoreboard({
  players,
  currentPlayerId,
  authenticatedPlayerId,
  isGameOver,
  onReplacePlayer,
  lastMoveTimestamp,
  onShowHistory,
  gameHistoryLength,
  gameCreatedAt,
}: ScoreboardProps) {
  const winningScore = Math.max(...players.map((player) => player.score));

  if (!players?.length) return null;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Scores
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onShowHistory}>
          <History className="h-5 w-5" />
          <span className="sr-only">Show Turn History</span>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {players.map((player, index) => {
            const isCurrentTurn = player.id === currentPlayerId;
            const isYou = player.id === authenticatedPlayerId;
            const isWinner = player.score === winningScore;

            const referenceTimestamp = lastMoveTimestamp || gameCreatedAt;
            
            const isInactive = (!!referenceTimestamp &&
              new Date(referenceTimestamp) <
                new Date(Date.now() - 30 * 60 * 1000));

            return (
              <li
                key={player.id}
                className={cn(
                  "flex justify-between items-center p-2 rounded-md transition-all group",
                  (isGameOver ? isWinner : isCurrentTurn)
                    ? "bg-accent/20 border-l-4 border-accent"
                    : "bg-muted/50",
                  isYou && "ring-2 ring-primary/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">
                    {player.name.toUpperCase()}
                    {isYou && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (You)
                      </span>
                    )}
                    {player?.isComputer && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (AI)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isInactive && isCurrentTurn && !player.isComputer && !isYou && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onReplacePlayer(player.id)}
                      title={`Replace ${player.name} with AI`}
                    >
                      <Bot className="h-4 w-4" />
                    </Button>
                  )}
                  {player.isComputer && (
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-bold text-lg text-primary">
                    {player.score}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
