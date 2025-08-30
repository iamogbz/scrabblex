"use client";

import { useState } from "react";
import type { Player } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, User, Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "./ui/card";

interface PlayerAuthDialogProps {
  players: Player[];
  onAuth: (playerId: string) => void;
}

export function PlayerAuthDialog({ players, onAuth }: PlayerAuthDialogProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const { toast } = useToast();

  const handleAuthenticate = () => {
    const player = players.find((p) => p.id === selectedPlayerId);
    if (player && player.code === code) {
      onAuth(player.id);
    } else {
      toast({
        title: "Authentication Failed",
        description: "The code you entered is incorrect. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <Dialog open={true}>
          <DialogContent
            className="sm:max-w-[425px]"
            onInteractOutside={(e) => e.preventDefault()}
            hideCloseButton={true}
          >
            <DialogHeader>
              <DialogTitle>Identify Yourself</DialogTitle>
              <DialogDescription>
                Select your name and enter your secret code to continue.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="player-select" className="text-right">
                  <User className="inline-block h-5 w-5" />
                </Label>
                <Select
                  value={selectedPlayerId}
                  onValueChange={setSelectedPlayerId}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select your name..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="player-code" className="text-right">
                  <KeyRound className="inline-block h-5 w-5" />
                </Label>
                <div className="relative col-span-3">
                  <Input
                    id="player-code"
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Your secret code"
                    className="pr-10"
                    onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowCode((s) => !s)}
                  >
                    {showCode ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAuthenticate}
                className="w-full"
                disabled={!selectedPlayerId || code.length === 0}
              >
                Authenticate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
