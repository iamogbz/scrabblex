
"use client";

import GameClient from "@/components/game-client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Home, LogOut, ChevronLeft } from "lucide-react";
import { useState, use } from "react";

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [leaveGameHandler, setLeaveGameHandler] = useState<(() => void) | null>(null);

  const handleLeave = () => {
    if (leaveGameHandler) {
      leaveGameHandler();
    }
  };
  
  return (
    <div className="relative min-h-screen bg-muted/40">
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Logo className="w-8 h-8"/>
          <span className="font-headline text-2xl tracking-wider">Scrabblex</span>
        </Link>
        <div className="flex items-center gap-2">
           <Button variant="ghost" onClick={handleLeave} disabled={!leaveGameHandler}>
              <LogOut className="mr-2 h-4 w-4" /> Back to Lobby
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/draw">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to Draw
              </Link>
            </Button>
          <Button variant="ghost" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>
      <main className="pt-20 pb-4">
        <GameClient gameId={gameId} setLeaveGameHandler={setLeaveGameHandler}/>
      </main>
    </div>
  );
}
