"use server";

import {
  createNewGame,
  getGame,
  updateGame,
} from "@/lib/game-service";
import { redirect } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";

let wordSet: Set<string>;

async function getWordSet() {
  if (wordSet) {
    return wordSet;
  }

  // Determine the base URL for the fetch request. This is necessary because
  // server-side fetch needs an absolute URL.
  // In a Vercel environment, VERCEL_URL is available. For local development,
  // we fall back to localhost.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;

  const url = `${baseUrl}/valid-words.txt`;

  const response = await fetch(url, {
    // The word list is static, so we can cache it aggressively.
    // Next.js fetch will cache this by default, but being explicit is good.
    cache: "force-cache",
  });

  console.log('Fetching valid words from:', url);

  if (!response.ok) {
    // This error suggests that `valid-words.txt` should be placed in the `public` directory
    // to be served as a static asset.
    throw new Error(
      `Failed to fetch valid-words.txt from ${url}: ${response.statusText}. Make sure the file is present in the /public directory.`
    );
  }

  const fileContent = await response.text();
  const words = fileContent
    .split("\n")
    .map((word) => word.trim().toUpperCase());
  wordSet = new Set(words);

  console.log(`Successfully loaded ${wordSet.size} words from ${url}.`);

  return wordSet;
}

export async function verifyWordAction(word: string) {
  const validWords = await getWordSet();
  return {
    isValid: validWords.has(word.toUpperCase()),
  };
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

export async function updateGameState(
  gameId: string,
  gameState: any,
  sha: string,
  message: string
) {
  await updateGame(gameId, gameState, sha, message);
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export async function getWordDefinition(word: string): Promise<string | null> {
  if (!genAI) {
    console.log("GEMINI_API_KEY not set, skipping definition lookup.");
    return "GEMINI_API_KEY not set.";
  }
  if (word.length < 2) {
    return null;
  }
  const invalidWord = "Not a valid Scrabble word.";
  const { isValid } = await verifyWordAction(word);
  if (!isValid) return invalidWord;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `Provide a concise, one-line definition for the Scrabble word "${word.toUpperCase()}". If it's not a valid word, say "${invalidWord}". Example: "LIT: past tense of light."`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
