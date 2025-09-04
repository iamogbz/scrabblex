
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
  rack: Tile[]; // This should be the filtered list of available (un-staged) tiles
  originalRack: Tile[]; // This is the full, original rack of the player
  onTileClick: (tile: Tile, originalIndex: number) => void;
  onRackClick: () => void;
  isMyTurn: boolean;
  selectedRackTileIndex: number | null;
  playerColor?: string;
}

export default function PlayerRack({
  rack,
  originalRack,
  onTileClick,
  onRackClick,
  isMyTurn,
  selectedRackTileIndex,
  playerColor,
}: PlayerRackProps) {
  // Create a copy of the original rack to safely find and "remove" tiles
  // as we match them to the display rack. This prevents re-selecting the same
  // tile if there are duplicates (e.g. two 'A' tiles).
  const originalRackCopy = [...originalRack];

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
          {rack.map((tile, displayIndex) => {
            // Find the index of this tile instance in our mutable copy of the original rack.
            const originalIndex = originalRackCopy.findIndex(
              (t) =>
                t && t.letter === tile.letter && t.points === tile.points
            );
            
            if (originalIndex !== -1) {
              // "Remove" the found tile from the copy so it's not found again.
              originalRackCopy.splice(originalIndex, 1, null as any);
            }

            return (
              <SingleTile
                key={`${tile.letter}-${displayIndex}`}
                tile={tile}
                onSelect={(e) => {
                  e.stopPropagation(); // Prevent onRackClick from firing
                  // We must use the original index from the full rack for the click handler.
                  onTileClick(tile, originalIndex);
                }}
                isDraggable={isMyTurn}
                isSelected={selectedRackTileIndex === originalIndex}
                playerColor={playerColor}
              />
            );
          })}
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
