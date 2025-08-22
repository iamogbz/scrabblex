
"use server";

import { verifyWord } from "@/ai/flows/verify-word";
import { createNewGame, getGame, updateGame } from "@/lib/game-service";
import { GameState } from "@/types";
import { redirect } from "next/navigation";
import type { z } from "zod";

function generateGameId(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createGame() {
  const gameId = generateGameId();
  await createNewGame(gameId);
  redirect(`/game/${gameId}`);
}

export async function getGameState(gameId: string) {
    return await getGame(gameId);
}

export async function updateGameState(gameId: string, gameState: GameState, sha: string) {
    await updateGame(gameId, gameState, sha);
}

export async function verifyWordAction(
  input: z.infer<typeof verifyWord.inputSchema>
): Promise<z.infer<typeof verifyWord.outputSchema>> {
    const result = await verifyWord(input);
    return result;
}
