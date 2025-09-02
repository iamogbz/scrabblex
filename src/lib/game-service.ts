/**
 * @fileoverview Service for interacting with GitHub to store and retrieve game state.
 */
import type { GameState, Tile } from "@/types";
import { createInitialBoard, TILE_BAG } from "./game-data";

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const GITHUB_USER_REPO = "iamogbz/scrabblex";
export const GITHUB_BRANCH_BASE = "main";
export const GITHUB_BRANCH_GAMES = "games";

const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER_REPO}/contents/`;

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

const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const countTiles = (tiles: Tile[]) => {
  return tiles.reduce((acc, tile) => {
    const letterToCount = tile.originalLetter
      ? tile.originalLetter
      : tile.letter;
    acc[letterToCount] = (acc[letterToCount] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

export async function getGame(
  gameId: string
): Promise<{ gameState: GameState; sha: string } | null> {
  if (!GITHUB_TOKEN) return null;
  try {
    const response = await fetch(
      `${GITHUB_API_URL}${gameId}.json?ref=${GITHUB_BRANCH_GAMES}`,
      {
        headers: githubHeaders,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch game: ${response.statusText}`);
    }

    const data = await response.json();
    let gameState: GameState = JSON.parse(fromBase64(data.content));
    gameState.players = gameState.players.map((player) => ({
      ...player,
      name: player.name.toUpperCase(),
    }));

    let sha: string = data.sha;
    let stateWasModified = false;
    // --- Board Reconstruction from History ---
    const reconstructedBoard = createInitialBoard();
    if (gameState.history) {
      gameState.history.forEach((playedWord) => {
        if (playedWord.tiles) {
          playedWord.tiles.forEach((tile) => {
            if (
              reconstructedBoard[tile.x] &&
              reconstructedBoard[tile.x][tile.y]
            ) {
              reconstructedBoard[tile.x][tile.y].tile = tile;
            }
          });
        }
      });
    }
    gameState.board = reconstructedBoard;

    if (gameState.gamePhase === "playing") {
      // --- Tile Bag Verification ---
      const initialTileCounts = countTiles(TILE_BAG);

      const tilesInRacks = gameState.players.flatMap((p) => p.rack);
      const tilesOnBoard = gameState.history.flatMap((h) =>
        h.tiles ? h.tiles.map((t) => ({
          letter: t.originalLetter || t.letter,
          points: t.points,
        })) : []
      );

      const tilesInPlay = [...tilesInRacks, ...tilesOnBoard];
      const tilesInPlayCounts = countTiles(tilesInPlay);

      const expectedTileBag: Tile[] = [];
      for (const letter in initialTileCounts) {
        const initialCount = initialTileCounts[letter];
        const inPlayCount = tilesInPlayCounts[letter] || 0;
        const expectedCountInBag = initialCount - inPlayCount;
        const tileInfo = TILE_BAG.find((t) => t.letter === letter)!;
        for (let i = 0; i < expectedCountInBag; i++) {
          expectedTileBag.push(tileInfo);
        }
      }

      const currentBagCounts = countTiles(gameState.tileBag);
      const expectedBagCounts = countTiles(expectedTileBag);

      const isBagCorrect =
        Object.keys(expectedBagCounts).length ===
          Object.keys(currentBagCounts).length &&
        Object.keys(expectedBagCounts).every(
          (letter) => expectedBagCounts[letter] === currentBagCounts[letter]
        );

      if (!isBagCorrect) {
        console.warn(`Correcting tile bag for game ${gameId}`);
        gameState.tileBag = shuffle(expectedTileBag);
        stateWasModified = true;
      }

      // --- Rack Replenishment ---
      const newTileBag = [...gameState.tileBag];
      const updatedPlayers = gameState.players.map((player) => {
        const tilesNeeded = 7 - player.rack.length;
        if (tilesNeeded > 0 && newTileBag.length > 0) {
          const tilesToDraw = Math.min(tilesNeeded, newTileBag.length);
          const newTiles = newTileBag.splice(0, tilesToDraw);
          stateWasModified = true;
          return {
            ...player,
            rack: [...player.rack, ...newTiles],
          };
        }
        return player;
      });

      if (stateWasModified) {
        const updatedGameState: GameState = {
          ...gameState,
          players: updatedPlayers,
          tileBag: newTileBag,
        };

        // The state was changed, so we must commit it back to GitHub.
        const updatedData = await updateGame(
          gameId,
          updatedGameState,
          sha,
          `SYSTEM: Corrected tile bag and player racks for game ${gameId}`
        );

        // Return the fresh state and the new SHA.
        return { gameState: updatedGameState, sha: updatedData.content.sha };
      }
    }

    return { gameState, sha };
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
        message: `feat: Create game ${gameId}`,
        content,
        branch: GITHUB_BRANCH_GAMES,
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
  sha: string,
  message?: string
): Promise<any> {
  if (!GITHUB_TOKEN) return;
  try {
    const content = toBase64(JSON.stringify(gameState, null, 2));

    const response = await fetch(`${GITHUB_API_URL}${gameId}.json`, {
      method: "PUT",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || `feat: Update game ${gameId}`,
        content,
        sha,
        branch: GITHUB_BRANCH_GAMES,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update game: ${error.message}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error updating game:", error);
    throw error;
  }
}
