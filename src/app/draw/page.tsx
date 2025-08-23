"use client";
import { createGame } from "@/app/actions";
import { JoinGameDialog } from "@/components/join-game-dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";
import Link from 'next/link';
import { Logo } from "@/components/logo";
import { LocalStorageKey } from "@/lib/constants";

export default function DrawPage() {
  const [gameHistory, setGameHistory] = useState<string[]>([]);

  useEffect(() => {
    // Ensure we are in a browser environment before accessing localStorage
    if (typeof window !== 'undefined') {
      const history = JSON.parse(localStorage.getItem(LocalStorageKey.GAMES) || '[]');
      // Convert Set back to Array for rendering
      setGameHistory(Array.from(new Set<string>(history)));
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-grid-gray-100/[0.1] p-4">
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
       <Link href="/" className="absolute top-4 left-4 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors z-20">
          <Logo className="w-8 h-8"/>
          <span className="font-headline text-2xl tracking-wider">Scrabblex</span>
        </Link>
      <Card className="w-full max-w-md text-center shadow-2xl z-10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4">
            <form action={createGame}>
              <Button type="submit" size="lg" className="w-full text-lg py-7 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="mr-2 h-6 w-6" /> Create New Game
              </Button>
            </form>
            <JoinGameDialog>
              <Button variant="outline" size="lg" className="w-full text-lg py-7">
                <Users className="mr-2 h-6 w-6" /> Join Existing Game
              </Button>
            </JoinGameDialog>
          </div>

          {gameHistory.length > 0 && (
            <div className="mt-8 space-y-2">
              <h3 className="text-lg font-semibold">Previous Games</h3>
              <div className="flex flex-col items-center space-y-2">
                {gameHistory.map((gameId) => (
                  <Link key={gameId} href={`/draw/${gameId}`} className="w-full text-primary hover:underline text-sm">
                    <Button variant="outline" size="lg" className="w-full text-lg py-7">{gameId}</Button>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
