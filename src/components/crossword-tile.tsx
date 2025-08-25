
import { cn } from '@/lib/utils';
import type { PlacedTile } from '@/types';
import { Input } from './ui/input';
import { useRef, useEffect } from 'react';

interface CrosswordTileProps {
  tile: PlacedTile | null;
  number?: number;
  isRevealed: boolean;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}

export default function CrosswordTile({ tile, number, isRevealed, value, onChange, onFocus }: CrosswordTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!tile) {
    return <div className="aspect-square bg-gray-800 rounded-sm md:rounded-md" />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 1) {
        onChange(val);
    }
  };

  useEffect(() => {
    if (isRevealed && inputRef.current) {
        inputRef.current.blur();
    }
  }, [isRevealed])

  return (
    <div
      className={cn(
        "aspect-square w-full h-full rounded-sm md:rounded-md flex items-center justify-center relative select-none",
        "bg-[#FBF8E8] border border-[#D5CFAF] text-[#5A4B40]",
        isRevealed && 'bg-green-100 border-green-300'
      )}
      style={{
        borderWidth: '0.3vmin',
        containerType: 'size',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {number && <span className="absolute top-0 left-0.5 text-[20cqw] font-bold">{number}</span>}

      {isRevealed ? (
        <span className={cn("font-bold font-headline")} style={{ fontSize: '50cqw'}}>{tile.letter}</span>
      ) : (
        <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={onFocus}
            maxLength={1}
            className={cn("w-full h-full bg-transparent border-0 text-center p-0 font-bold font-headline focus-visible:ring-0 focus-visible:ring-offset-0",
             value.toUpperCase() === tile.letter ? "text-green-700" : "text-blue-600"
            )}
            style={{ fontSize: '50cqw'}}
        />
      )}
    </div>
  );
}
