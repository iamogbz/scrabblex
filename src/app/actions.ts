
"use server";

import { createNewGame, getGame, updateGame } from "@/lib/game-service";
import { GameState } from "@/types";
import { redirect } from "next/navigation";
import fs from 'fs/promises';
import path from 'path';

let wordSet: Set<string>;

async function getWordSet() {
    if (wordSet) {
        return wordSet;
    }
    const filePath = path.join(process.cwd(), 'src', 'lib', 'valid-words.txt');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const words = fileContent.split('\n').map(word => word.trim().toUpperCase());
    wordSet = new Set(words);
    return wordSet;
}

export async function verifyWordAction(word: string): Promise<{ isValid: boolean }> {
    const validWords = await getWordSet();
    return { isValid: validWords.has(word.toUpperCase()) };
}


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
  redirect(`/draw/${gameId}`);
}

export async function getGameState(gameId: string) {
    return await getGame(gameId);
}

export async function updateGameState(gameId: string, gameState: GameState, sha: string, message?: string) {
    await updateGame(gameId, gameState, sha, message);
}
