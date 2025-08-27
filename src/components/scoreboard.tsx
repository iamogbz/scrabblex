import type { Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { Award, User } from "lucide-react";

interface ScoreboardProps {
  players: Player[];
  currentPlayerId: string;
  authenticatedPlayerId: string | null;
  isGameOver?: boolean;
}

export default function Scoreboard({
  players,
  currentPlayerId,
  authenticatedPlayerId,
  isGameOver,
}: ScoreboardProps) {
  const winningScore = Math.max(...players.map((player) => player.score));

  if (!players?.length) return null;

  return (
    <Card className="max-w-md w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {players.map((player) => {
            const isCurrentTurn = player.id === currentPlayerId;
            const isYou = player.id === authenticatedPlayerId;
            const isWinner = player.score === winningScore;
            return (
              <li
                key={player.id}
                className={cn(
                  "flex justify-between items-center p-2 rounded-md transition-all",
                  (isGameOver ? isWinner : isCurrentTurn)
                    ? "bg-accent/20 border-l-4 border-accent"
                    : "bg-muted/50",
                  isYou && "ring-2 ring-primary/50"
                )}
              >
                <span className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {player.name.toUpperCase()}
                  {isYou && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (You)
                    </span>
                  )}
                </span>
                <span className="font-bold text-lg text-primary">
                  {player.score}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
