import { createGame } from "@/app/actions";
import { JoinGameDialog } from "@/components/join-game-dialog";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Plus, Users } from "lucide-react";

export default function DrawPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-grid-gray-100/[0.1] p-4">
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <Card className="w-full max-w-md text-center shadow-2xl z-10 border-primary/20">
        <CardHeader>
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-4 w-24 h-24 flex items-center justify-center mb-4 border-4 border-background shadow-inner">
            <Logo className="w-16 h-16" />
          </div>
          <CardTitle className="text-5xl font-headline tracking-wider">Lexicle</CardTitle>
          <CardDescription className="text-lg pt-2">
            The classic word game, reimagined.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          <p className="text-sm text-muted-foreground mt-6">
            <Gamepad2 className="inline-block h-4 w-4 mr-1" />
            Challenge your friends and expand your vocabulary.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
