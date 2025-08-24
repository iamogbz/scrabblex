import { cn } from '@/lib/utils';
import type { Tile } from '@/types';

function darkenColor(hex: string, percent: number) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.max(0, r - Math.round(2.55 * percent));
  g = Math.max(0, g - Math.round(2.55 * percent));
  b = Math.max(0, b - Math.round(2.55 * percent));

  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function contrastColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface TileProps {
  tile: Tile;
  isDraggable?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
  isTemp?: boolean;
  playerColor?: string;
}

export default function SingleTile({ tile, isDraggable = true, onSelect, isSelected, isTemp = false, playerColor }: TileProps) {
  const backgroundColor = playerColor ?? ""
  const borderColor = backgroundColor && darkenColor(backgroundColor, 20); // Darken by 20%
  const textColor = playerColor && contrastColor(playerColor);
  return (
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer",
        "aspect-square w-full h-full rounded-sm md:rounded-md flex items-center justify-center relative select-none shadow-sm",
        "bg-[#FBF8E8] border border-[#D5CFAF] text-[#5A4B40]",
        isDraggable && "cursor-pointer transition-transform duration-150 ease-in-out hover:scale-105 hover:-translate-y-1",
        isSelected && isDraggable && "ring-2 ring-accent ring-offset-2 scale-105",
        isTemp && "ring-2 ring-green-500"
      )}
      style={{
        backgroundColor,
        borderColor,
        borderWidth: '2px',
        containerType: 'size',
        color: 'unset', // Remove default text color
      }}
    >
      <span className={cn("font-bold font-headline mr-1 mb-1")} style={{ color: textColor, fontSize: '50cqw'}}>{tile.letter}</span>
      <span className={cn("absolute bottom-0 right-1 font-bold")} style={{ color: textColor, fontSize: '30cqw' }}>{tile.points}</span>
    </div>
  );
}
