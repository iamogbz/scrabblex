
/**
 * @fileoverview Service for interacting with GitHub to store and retrieve game state.
 */
import type { GameState, Tile } from "@/types";
import { createInitialBoard, TILE_BAG } from "./game-data";

const GITHUB_REPO = "iamogbz/scrabblex";
const GITHUB_BRANCH = "games";

const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/`;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.warn(
    "GITHUB_TOKEN environment variable is not set. Game state will not be persisted."
  );
}

const githubHeaders = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

// Helper to encode content to Base64
function toBase64(str: string): string {
  return Buffer.from(str, "utf8").toString("base64");
}

// Helper to decode content from Base64
function fromBase64(str: string): string {
  return Buffer.from(str, "base64").toString("utf8");
}

const shuffle = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

export async function getGame(
  gameId: string
): Promise<{ gameState: GameState; sha: string } | null> {
  if (!GITHUB_TOKEN) return null;
  try {
    const response = await fetch(`${GITHUB_API_URL}${gameId}.json?ref=${GITHUB_BRANCH}`, {
      headers: githubHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch game: ${response.statusText}`);
    }

    const data = await response.json();
    const gameState: GameState = JSON.parse(fromBase64(data.content));

    return { gameState, sha: data.sha };
  } catch (error) {
    console.error("Error getting game:", error);
    return null;
  }
}

export async function createNewGame(gameId: string): Promise<GameState> {
  const initialGameState: GameState = {
    gameId,
    players: [],
    tileBag: shuffle(TILE_BAG),
    board: createInitialBoard(),
    history: [],
    gamePhase: "playing",
  };

  if (!GITHUB_TOKEN) {
    console.log("No GitHub token, returning in-memory game state.");
    return initialGameState;
  }

  try {
    const content = toBase64(JSON.stringify(initialGameState, null, 2));
    const response = await fetch(`${GITHUB_API_URL}${gameId}.json`, {
      method: "PUT",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Create game ${gameId}`,
        content,
        branch: GITHUB_BRANCH,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create game: ${error.message}`);
    }

    return initialGameState;
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}

export async function updateGame(
  gameId: string,
  gameState: GameState,
  sha: string
): Promise<void> {
  if (!GITHUB_TOKEN) return;
  try {
    const content = toBase64(JSON.stringify(gameState, null, 2));

    const response = await fetch(`${GITHUB_API_URL}${gameId}.json`, {
      method: "PUT",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Update game ${gameId}`,
        content,
        sha,
        branch: GITHUB_BRANCH,
      }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update game: ${error.message}`);
    }
  } catch (error) {
    console.error("Error updating game:", error);
    throw error;
  }
}
