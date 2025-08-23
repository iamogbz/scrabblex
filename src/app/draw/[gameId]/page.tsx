
"use client";

import GameClient from "@/components/game-client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Home, LogOut, ChevronLeft } from "lucide-react";
import { useState, use } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


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
        <TooltipProvider>
          <div className="flex items-center gap-1 md:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={handleLeave} disabled={!leaveGameHandler} size="icon" className="md:w-auto md:px-4">
                  <LogOut className="h-4 w-4" /> 
                  <span className="hidden md:inline ml-2">Back to Lobby</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">
                <p>Back to Lobby</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" asChild size="icon" className="md:w-auto md:px-4">
                  <Link href="/draw">
                    <ChevronLeft className="h-4 w-4" /> 
                    <span className="hidden md:inline ml-2">Back to Draw</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">
                <p>Back to Draw</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" asChild size="icon" className="md:w-auto md:px-4">
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span className="hidden md:inline ml-2">Back to Home</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">
                <p>Back to Home</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>
      <main className="pt-20 pb-4">
        <GameClient gameId={gameId} setLeaveGameHandler={setLeaveGameHandler}/>
      </main>
    </div>
  );
}
