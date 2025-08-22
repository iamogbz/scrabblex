import { createGame } from "@/app/actions";
import { JoinGameDialog } from "@/components/join-game-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function DrawPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-grid-gray-100/[0.1] p-4">
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
       <Link href="/" className="absolute top-4 left-4 flex items-center gap-2 text-primary hover:text-primary/80 transition-colors z-20">
          <Logo className="w-8 h-8"/>
          <span className="font-headline text-2xl tracking-wider">Lexicle</span>
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
        </CardContent>
      </Card>
    </main>
  );
}
