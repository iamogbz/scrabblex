
import type { Tile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import SingleTile from "./tile";
import { Hand } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerRackProps {
  rack: Tile[];
  onTileSelect: (tile: Tile) => void;
  isMyTurn: boolean;
}

export default function PlayerRack({ rack, onTileSelect, isMyTurn }: PlayerRackProps) {
  return (
    <Card className={cn("shadow-lg transition-all duration-300", !isMyTurn && "opacity-60")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Hand className="h-5 w-5"/>
            Your Tiles
        </CardTitle>
        {!isMyTurn && <CardDescription>Wait for your turn to play.</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {rack.map((tile, index) => (
            <SingleTile
              key={index}
              tile={tile}
              onSelect={() => onTileSelect(tile)}
              isDraggable={isMyTurn}
            />
          ))}
          {Array.from({ length: 7 - rack.length }).map((_, index) => (
             <div key={`empty-${index}`} className="aspect-square bg-muted/50 rounded-md" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
