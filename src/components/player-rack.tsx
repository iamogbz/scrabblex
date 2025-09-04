
import type { Tile } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import SingleTile from "./tile";
import { Hand } from "lucide-react";

interface PlayerRackProps {
  rack: Tile[];
  onTileClick: (tile: Tile, index: number) => void;
  onRackClick: () => void;
  isMyTurn: boolean;
  selectedRackTileIndex: number | null;
  playerColor?: string;
}

export default function PlayerRack({
  rack,
  onTileClick,
  onRackClick,
  isMyTurn,
  selectedRackTileIndex,
  playerColor,
}: PlayerRackProps) {
  return (
    <Card
      className="shadow-lg transition-all duration-300"
      onClick={onRackClick}
    >
      <CardHeader className={!isMyTurn ? "opacity-60" : ""}>
        <CardTitle className="flex items-center gap-2">
          <Hand className="h-5 w-5" />
          Your Tiles
        </CardTitle>
        {!isMyTurn && (
          <CardDescription>
            Not your turn but you can still stage your letters.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {rack.map((tile, index) => (
            <SingleTile
              key={index}
              tile={tile}
              onSelect={(e) => {
                e.stopPropagation(); // Prevent onRackClick from firing
                onTileClick(tile, index);
              }}
              isDraggable={isMyTurn}
              isSelected={selectedRackTileIndex === index}
              playerColor={playerColor}
            />
          ))}
          {Array.from({ length: 7 - rack.length }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="aspect-square bg-muted/50 rounded-md"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
