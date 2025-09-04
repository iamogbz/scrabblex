
import { cn } from "@/lib/utils";
import type { Tile } from "@/types";

interface TileProps {
  tile: Tile;
  isDraggable?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  isTemp?: boolean;
  playerColor?: string;
}

export default function SingleTile({
  tile,
  isDraggable = true,
  onSelect,
  isSelected,
  isTemp = false,
  playerColor,
}: TileProps) {
  const isBlank = tile.letter === " ";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer user-select-none",
        "aspect-square w-full h-full rounded-sm md:rounded-md flex items-center justify-center relative select-none shadow-sm",
        "bg-[#FBF8E8] border border-[#D5CFAF] text-[#5A4B40]",
        isDraggable &&
          "cursor-pointer transition-transform duration-150 ease-in-out hover:scale-105 hover:-translate-y-1",
        isSelected && "ring-2 ring-accent ring-offset-2 scale-105 z-10",
        isTemp && "ring-green-500"
      )}
      style={{
        borderWidth: "0.3vmin",
        containerType: "size",
        backgroundColor: playerColor,
      }}
    >
      <span
        className={cn("font-bold font-headline mr-1 mb-1")}
        style={{ fontSize: "50cqw" }}
      >
        {isBlank ? "?" : tile.letter}
      </span>
      <span
        className={cn("absolute bottom-0 right-1 font-bold")}
        style={{ fontSize: "20cqw" }}
      >
        {tile.points}
      </span>
    </div>
  );
}
