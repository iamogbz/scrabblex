import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Link href="/draw">
        <Card className="w-64 h-64 flex flex-col items-center justify-center text-center shadow-2xl z-10 border-primary/20 hover:bg-accent/10 transition-colors">
          <CardHeader>
            <Gamepad2 className="w-24 h-24 mx-auto text-primary" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl font-headline tracking-wider">Draw</CardTitle>
          </CardContent>
        </Card>
      </Link>
    </main>
  );
}
