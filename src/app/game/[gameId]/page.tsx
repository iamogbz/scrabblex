import GameClient from "@/components/game-client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Home } from "lucide-react";

export default function GamePage({ params }: { params: { gameId: string } }) {
  return (
    <div className="relative min-h-screen bg-muted/40">
       <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Logo className="w-8 h-8"/>
          <span className="font-headline text-2xl tracking-wider">Lexicle</span>
        </Link>
        <Button variant="ghost" asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main className="pt-20 pb-4">
        <GameClient gameId={params.gameId} />
      </main>
    </div>
  );
}
