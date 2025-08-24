
"use server";

import { createNewGame, getGame, updateGame } from "@/lib/game-service";
import { GameState } from "@/types";
import { redirect } from "next/navigation";
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function getWordDefinition(word: string): Promise<string | null> {
  if (!genAI) {
    console.log("GEMINI_API_KEY not set, skipping definition lookup.");
    return "GEMINI_API_KEY not set.";
  }
  if (word.length < 2) {
    return null;
  }

  const invalidWord = "Not a valid Scrabble word."
  const { isValid } = await verifyWordAction(word);
  if (!isValid) return invalidWord;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `Provide a concise, one-line definition for the Scrabble word "${word.toUpperCase()}". If it's not a valid word, say "${invalidWord}". Example: "LIT: past tense of light."`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
