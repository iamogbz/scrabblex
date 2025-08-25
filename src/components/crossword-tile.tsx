
import { cn } from '@/lib/utils';
import type { PlacedTile } from '@/types';

interface CrosswordTileProps {
  tile: PlacedTile | null;
}

export default function CrosswordTile({ tile }: CrosswordTileProps) {
  if (!tile) {
    return <div className="aspect-square bg-gray-800 rounded-sm md:rounded-md" />;
  }

  return (
    <div
      className={cn(
        "aspect-square w-full h-full rounded-sm md:rounded-md flex items-center justify-center relative select-none",
        "bg-[#FBF8E8] border border-[#D5CFAF] text-[#5A4B40]",
      )}
      style={{
        borderWidth: '0.3vmin',
        containerType: 'size',
      }}
    >
      <span className={cn("font-bold font-headline")} style={{ fontSize: '50cqw'}}>{tile.letter}</span>
    </div>
  );
}
