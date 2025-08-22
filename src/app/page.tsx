import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
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
            <Button asChild size="lg" className="w-full text-lg py-7">
                <Link href="/draw">
                    Start Playing <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
            </Button>
          <p className="text-sm text-muted-foreground mt-6">
            <Gamepad2 className="inline-block h-4 w-4 mr-1" />
            Challenge your friends and expand your vocabulary.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
