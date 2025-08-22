
"use server";

import { verifyWord } from "@/ai/flows/verify-word";
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
  redirect(`/game/${gameId}`);
}

export async function verifyWordAction(
  input: z.infer<typeof verifyWord.inputSchema>
): Promise<z.infer<typeof verifyWord.outputSchema>> {
    const result = await verifyWord(input);
    return result;
}
