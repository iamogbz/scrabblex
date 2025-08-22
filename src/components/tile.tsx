import { cn } from '@/lib/utils';
import type { Tile } from '@/types';

interface TileProps {
  tile: Tile;
  isDraggable?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
  isTemp?: boolean;
}

export default function SingleTile({ tile, isDraggable = true, onSelect, isSelected, isTemp = false }: TileProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "aspect-square w-full h-full rounded-sm md:rounded-md flex items-center justify-center relative select-none shadow-sm",
        "bg-[#FBF8E8] border border-[#D5CFAF] text-[#5A4B40]",
        isDraggable && "cursor-pointer transition-transform duration-150 ease-in-out hover:scale-105 hover:-translate-y-1",
        isSelected && "ring-2 ring-accent ring-offset-2 scale-105 -translate-y-1",
        isTemp && "ring-2 ring-green-500"
      )}
    >
      <span className="text-sm md:text-xl lg:text-2xl font-bold font-headline">{tile.letter}</span>
      <span className="absolute bottom-0 right-1 text-[8px] md:text-[10px] font-bold">{tile.points}</span>
    </div>
  );
}
