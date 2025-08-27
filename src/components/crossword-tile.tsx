
"use client";

import { cn } from '@/lib/utils';
import type { PlacedTile } from '@/types';
import { Input } from './ui/input';
import { useRef, useEffect, forwardRef } from 'react';

interface CrosswordTileProps {
  id: string;
  tile: PlacedTile | null;
  number?: number;
  isRevealed: boolean;
  value: string;
  onChange: (value: string) => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isActive: boolean;
  isPartiallyActive: boolean;
}

const CrosswordTile = forwardRef<HTMLInputElement, CrosswordTileProps>(
  ({ id, tile, number, isRevealed, value, onChange, onClick, onKeyDown, isActive, isPartiallyActive }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    
    // Allow parent to focus this input
    useEffect(() => {
        if (typeof ref === 'function') {
            ref(internalRef.current);
        } else if (ref) {
            ref.current = internalRef.current;
        }
    }, [ref]);


    if (!tile) {
      return <div className="aspect-square bg-gray-800 rounded-sm md:rounded-md" />;
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Get last character in case of pasting or overwrite
      const lastChar = val.slice(-1);
      onChange(lastChar);
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isRevealed) {
        // Also focus the input
        internalRef.current?.focus();
      }
      // We stop propagation to prevent the input click from firing,
      // which could cause a double-fire of the onClick handler
      e.stopPropagation();
      onClick?.()
    };
    
    const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
        // When the input itself is clicked, also fire the main onClick
        // so board logic (like changing direction) still works.
        e.stopPropagation();
        onClick?.();
    }

    useEffect(() => {
      if (isPartiallyActive && internalRef.current) {
        internalRef.current.focus();
      }
    }, [isPartiallyActive]);
    
    useEffect(() => {
      if (isRevealed && internalRef.current) {
          internalRef.current.blur();
      }
    }, [isRevealed])

    return (
      <div
        id={id}
        className={cn(
          "aspect-square w-full h-full rounded-[0.3vmin] flex items-center justify-center relative select-none transition-colors",
          "bg-[#FBF8E8] border border-[#D5CFAF] text-[#5A4B40]",
          isRevealed ? "bg-green-200 border-green-400" : "",
          isActive && !isRevealed && "bg-blue-100",
          isPartiallyActive && !isRevealed && "ring-2 ring-primary"
        )}
        style={{
          borderWidth: '0.1vmin',
          containerType: 'size',
          cursor: isRevealed ? 'default' : 'pointer',
        }}
        onClick={handleClick}
      >
        {number && <span className="absolute top-0 left-1 text-[24cqw] font-bold pointer-events-none">{number}</span>}

        {isRevealed ? (
          <span className={cn("font-bold font-headline")} style={{ fontSize: '50cqw'}}>{tile.letter}</span>
        ) : (
          <Input
              ref={internalRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              onClick={handleInputClick}
              maxLength={1}
              className={cn("w-full h-full bg-transparent border-0 text-center p-0 font-bold font-headline focus-visible:ring-primary focus-visible:ring-offset-0 rounded-0",
                // only show the green confirmation when both letter is correct revealed
                isRevealed && value.toUpperCase() === tile.letter ? "text-green-700" : "text-blue-600"
              )}
              style={{
                borderWidth: 0,
                borderRadius: "0.3vmin",
                fontSize: 'clamp(16px, 50cqw, 40px)',
                caretColor: 'transparent'
              }}
              readOnly={isRevealed}
          />
        )}
      </div>
    );
  }
);
CrosswordTile.displayName = "CrosswordTile";

export default CrosswordTile;
 
