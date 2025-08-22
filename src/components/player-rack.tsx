import type { Tile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import SingleTile from "./tile";
import { Hand } from "lucide-react";

interface PlayerRackProps {
  rack: Tile[];
  onTileSelect: (tile: Tile, index: number) => void;
  selectedTileIndex: number | null;
}

export default function PlayerRack({ rack, onTileSelect, selectedTileIndex }: PlayerRackProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Hand className="h-5 w-5"/>
            Your Tiles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {rack.map((tile, index) => (
            <SingleTile
              key={index}
              tile={tile}
              onSelect={() => onTileSelect(tile, index)}
              isSelected={selectedTileIndex === index}
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
