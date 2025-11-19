
"use server";

import {
  createNewGame,
  getGame,
  GITHUB_BRANCH_BASE,
  GITHUB_USER_REPO,
  updateGame,
} from "@/lib/game-service";
import {
  getDictionaryWord,
  updateDictionaryWord,
  getDictionaryWords,
  updateDictionaryWords,
} from "@/lib/dictionary-service";
import { redirect } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "@octokit/rest";
import {
  Board,
  BoardSquare,
  GameState,
  PlacedTile,
  Player,
  Tile,
  PlayedWord,
} from "@/types";
import { calculateMoveScore } from "@/lib/scoring";
import { createInitialBoard, TILE_BAG } from "@/lib/game-data";
import { capitalize, shuffle } from "@/lib/utils";
import {
  INVALID_WORD_ERROR,
  NO_API_KEY_ERROR,
  UNDEFINED_WORD_ERROR,
  UNDEFINED_WORD_VALID,
} from "@/lib/constants";
import { generateCrosswordTitle } from "@/ai/flows/title-flow";

let wordSet: Set<string>;
const definitionCache = new Map<string, string | null>();

async function getWordSet() {
  if (wordSet) {
    return wordSet;
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 9002}`;

  const url = `${baseUrl}/valid-words.txt`;

  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch valid-words.txt from ${url}: ${response.statusText}. Make sure the file is present in the /public directory.`
      );
    }
    const fileContent = await response.text();
    const words = fileContent
      .split("\n")
      .map((word) => word.trim().toUpperCase());
    wordSet = new Set(words);
    return wordSet;
  } catch (error) {
    console.error("Error fetching or parsing word set:", error);
    // Fallback or re-throw, depending on desired behavior.
    // For now, re-throwing to make it clear that the app can't function without the word list.
    throw error;
  }
}

export async function verifyWordAction(word: string) {
  try {
    const validWords = await getWordSet();
    return {
      isValid: validWords.has(word.toUpperCase()),
    };
  } catch (error) {
    console.error(
      "Failed to verify word due to word set loading error:",
      error
    );
    return { isValid: false, error: "Could not load dictionary." };
  }
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
  redirect(`/play/${gameId}`);
}

export async function getGameState(gameId: string) {
  return await getGame(gameId.toUpperCase());
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

async function getDefinitionFromDictionaryAPI(
  word: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const firstMeaning: {
      definitions: { definition: string }[];
      partOfSpeech: string;
    } = data[0]?.meanings[0];
    if (firstMeaning) {
      const { definition } =
        firstMeaning.definitions.find(
          (def) => !def.definition.toLowerCase().includes(word.toLowerCase())
        ) || {};
      const partOfSpeech = firstMeaning.partOfSpeech;
      if (definition) {
        return `(${capitalize(partOfSpeech)}) ${capitalize(definition)}`;
      }
    }
    return null;
  } catch (error) {
    console.log(`DictionaryAPI lookup failed for "${word}":`, error);
    return null;
  }
}

export async function getWordDefinition(
  word: string,
  forceRefresh = false
): Promise<string | null> {
  const upperCaseWord = word.toUpperCase();

  if (!forceRefresh && definitionCache.has(upperCaseWord)) {
    return definitionCache.get(upperCaseWord)!;
  }
  if (forceRefresh) {
    definitionCache.delete(upperCaseWord);
  }

  // 1. Check GitHub cache if not forcing a refresh
  if (!forceRefresh) {
    const cachedDefinition = await getDictionaryWord(upperCaseWord);
    if (cachedDefinition) {
      definitionCache.set(upperCaseWord, cachedDefinition);
      return cachedDefinition;
    }
  }

  // 2. Before any API calls, verify it's a valid Scrabble word
  const { isValid } = await verifyWordAction(upperCaseWord);
  if (!isValid) {
    return INVALID_WORD_ERROR;
  }

  // 3. Try the fast, dedicated dictionary API first
  const apiDefinition = await getDefinitionFromDictionaryAPI(upperCaseWord);
  if (apiDefinition && !apiDefinition.toUpperCase().includes(upperCaseWord)) {
    definitionCache.set(upperCaseWord, apiDefinition);
    await updateDictionaryWord(upperCaseWord, apiDefinition);
    return apiDefinition;
  }

  // 4. Fallback to Gemini if the dictionary API fails
  if (!genAI) {
    console.log("GEMINI_API_KEY not set, skipping definition lookup.");
    return NO_API_KEY_ERROR;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `Provide a concise, one-line definition for the Scrabble word "${upperCaseWord}", prepended with its language of origin in parentheses. Your response must not include the word "${upperCaseWord}" itself. If you cannot provide a definition, your entire response must be only the exact phrase "${UNDEFINED_WORD_ERROR}". Example: (Latin) A type of cheese.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const geminiDefinition = response.text();

    console.log(`Gemini definition for "${upperCaseWord}":`, geminiDefinition);

    if (geminiDefinition && !geminiDefinition.includes(UNDEFINED_WORD_ERROR)) {
      definitionCache.set(upperCaseWord, geminiDefinition);
      await updateDictionaryWord(upperCaseWord, geminiDefinition);
      return geminiDefinition;
    } else {
      // It's a valid word, but AI can't define it.
      return UNDEFINED_WORD_VALID;
    }
  } catch (error) {
    console.error(
      `Error fetching Gemini definition for "${upperCaseWord}":`,
      error
    );
    // It's a valid word, but there was an API error.
    return UNDEFINED_WORD_VALID;
  }
}

export async function getWordDefinitions(
  words: string[]
): Promise<Record<string, string | null>> {
  const upperCaseWords = words.map((w) => w.toUpperCase());
  const results: Record<string, string | null> = {};
  const wordsToFetch: string[] = [];

  // 1. Check in-memory cache
  for (const word of upperCaseWords) {
    if (definitionCache.has(word)) {
      results[word] = definitionCache.get(word)!;
    } else {
      wordsToFetch.push(word);
    }
  }

  if (wordsToFetch.length === 0) return results;

  // 2. Check GitHub cache
  const githubCachedDefinitions = await getDictionaryWords(wordsToFetch);
  const wordsNotFoundInGithub: string[] = [];
  for (const word of wordsToFetch) {
    if (githubCachedDefinitions[word]) {
      results[word] = githubCachedDefinitions[word];
      definitionCache.set(word, githubCachedDefinitions[word]);
    } else {
      wordsNotFoundInGithub.push(word);
    }
  }

  if (wordsNotFoundInGithub.length === 0) return results;

  // 3. Verify words and try DictionaryAPI for remaining
  const wordsForGemini: string[] = [];
  const definitionsToCache: Record<string, string> = {};

  const dictionaryApiPromises = wordsNotFoundInGithub.map(async (word) => {
    const { isValid } = await verifyWordAction(word);
    if (!isValid) {
      results[word] = INVALID_WORD_ERROR;
      return;
    }

    const apiDefinition = await getDefinitionFromDictionaryAPI(word);
    if (apiDefinition) {
      results[word] = apiDefinition;
      definitionCache.set(word, apiDefinition);
      definitionsToCache[word] = apiDefinition;
    } else {
      wordsForGemini.push(word);
    }
  });
  await Promise.all(dictionaryApiPromises);

  if (Object.keys(definitionsToCache).length > 0) {
    await updateDictionaryWords(definitionsToCache);
  }

  if (wordsForGemini.length === 0) return results;

  // 4. Fallback to Gemini for the rest
  if (!genAI) {
    for (const word of wordsForGemini) {
      results[word] = NO_API_KEY_ERROR;
    }
    return results;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `
    You are a dictionary expert. For each of the Scrabble words provided, give a concise, one-line definition, prepended with its language of origin in parentheses.
    Pay close attention to whether the word is singular or plural and phrase the definition accordingly.
    **Crucially, the definition must not contain the word itself.**
    Your response must be only a valid JSON object where the key is the uppercase word and the value is its definition string.
    If you are unable to define a word, use the exact phrase "${UNDEFINED_WORD_ERROR}" as its value. Do not include any other text, explanations, or markdown formatting in your response.

    Example Request: ["DOG", "CAT"]
    Example Response: {"DOG":"(Proto-Germanic) A domesticated carnivorous mammal.","CAT":"(Late Latin) A small domesticated carnivorous mammal with soft fur."}

    Words: ${JSON.stringify(wordsForGemini)}
  `;

  try {
    const generationResult = await model.generateContent(prompt);
    const responseText = generationResult.response.text();
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const definitionsFromApi = JSON.parse(jsonString) as Record<string, string>;
    const geminiDefinitionsToCache: Record<string, string> = {};

    for (const word of wordsForGemini) {
      const definition = definitionsFromApi[word];
      if (definition && !definition.includes(UNDEFINED_WORD_ERROR)) {
        results[word] = definition;
        definitionCache.set(word, definition);
        geminiDefinitionsToCache[word] = definition;
      } else {
        // It's a valid word, but AI couldn't define it.
        results[word] = UNDEFINED_WORD_VALID;
      }
    }

    if (Object.keys(geminiDefinitionsToCache).length > 0) {
      await updateDictionaryWords(geminiDefinitionsToCache);
    }
  } catch (error) {
    console.error("Failed to fetch or parse batch Gemini definitions:", error);
    for (const word of wordsForGemini) {
      results[word] = UNDEFINED_WORD_VALID; // It's a valid word, but the API failed
    }
  }

  return results;
}

const DICTIONARY_PATH = "public/valid-words.txt";

export async function reportBugAction(
  title: string,
  body: string,
  playerName: string,
  gameId: string,
  gameSha: string | null
): Promise<{
  success: boolean;
  error?: string;
  issueUrl?: string;
  issueNumber?: number;
}> {
  const [GITHUB_OWNER, GITHUB_REPO] = GITHUB_USER_REPO.split("/");
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return {
      success: false,
      error: "Server is not configured for bug reports.",
    };
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    const enhancedBody = `
**Bug Report**

${body}

---
*This issue was submitted automatically from the ScrabbleX application.*

Timestamp: ${new Date().toUTCString()}
Player: ${playerName}
Game ID: ${gameId}
Game State: ${gameSha || "N/A"}

[View Game](https://scrabblex.com/play/${gameId})
    `;

    const { data: issue } = await octokit.issues.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title: title,
      body: enhancedBody,
      labels: ["bug"],
    });

    return {
      success: true,
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    };
  } catch (error: any) {
    console.error("Failed to create GitHub issue:", error);
    return {
      success: false,
      error:
        error.message ||
        "An unexpected error occurred while creating the issue.",
    };
  }
}

export async function suggestWordAction(
  word: string,
  playerName: string,
  gameId: string
): Promise<{
  success: boolean;
  error?: string;
  prUrl?: string;
  prNumber?: number;
}> {
  const [GITHUB_OWNER, GITHUB_REPO] = GITHUB_USER_REPO.split("/");
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return {
      success: false,
      error: "Server is not configured for suggestions.",
    };
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const upperCaseWord = word.trim().toUpperCase();

  if (!/^[A-Z]{2,}$/.test(upperCaseWord)) {
    return { success: false, error: "Invalid word format." };
  }

  const branchName = `feat/add-word-${upperCaseWord.toLowerCase()}`;

  try {
    const { data: baseBranch } = await octokit.repos.getBranch({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH_BASE,
    });
    const baseSha = baseBranch.commit.sha;

    try {
      await octokit.git.createRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
    } catch (error: any) {
      if (error.status !== 422) {
        // 422 is "Reference already exists"
        throw error;
      }
    }

    const { data: fileData } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DICTIONARY_PATH,
      ref: branchName,
    });

    if (!("content" in fileData)) {
      throw new Error("Could not retrieve dictionary content.");
    }

    const currentContent = Buffer.from(fileData.content, "base64").toString(
      "utf8"
    );
    const fileSha = fileData.sha;

    const words = new Set(
      currentContent.split("\n").map((w) => w.trim().toUpperCase())
    );

    if (words.has(upperCaseWord)) {
      return {
        success: false,
        error: `Word "${upperCaseWord}" already exists.`,
      };
    }

    words.add(upperCaseWord);
    const newContent = Array.from(words).sort().join("\n") + "\n";

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DICTIONARY_PATH,
      message: `feat: Add "${upperCaseWord}" to dictionary`,
      content: Buffer.from(newContent).toString("base64"),
      sha: fileSha,
      branch: branchName,
    });

    const { data: pullRequest } = await octokit.pulls.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title: `feat: Add word "${upperCaseWord}"`,
      head: branchName,
      base: GITHUB_BRANCH_BASE,
      body: `Adds the word "${upperCaseWord}" to the dictionary, as suggested by a user.

Player: ${playerName}
Game ID: ${gameId}
Timestamp: ${new Date().toUTCString()}`,
    });

    return {
      success: true,
      prUrl: pullRequest.html_url,
      prNumber: pullRequest.number,
    };
  } catch (error: any) {
    console.error("Failed to suggest word:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred.",
    };
  }
}

type WordSuggestion = {
  word: string;
  tiles: PlacedTile[];
  score: number;
};

// Helper function to check if a word can be formed from the letters in the rack
const canMakeWord = (word: string, rackLetters: string[]) => {
  const rackCounts = rackLetters.reduce((acc, letter) => {
    acc[letter] = (acc[letter] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  for (const letter of word) {
    if (!rackCounts[letter] || rackCounts[letter] === 0) {
      if (rackCounts[" "]) {
        rackCounts[" "]--;
      } else {
        return false;
      }
    } else {
      rackCounts[letter]--;
    }
  }
  return true;
};

// Main function to get word suggestions
export async function getWordSuggestions(
  board: BoardSquare[][],
  rack: Tile[]
): Promise<WordSuggestion[]> {
  const dictionary = await getWordSet();
  const suggestions: WordSuggestion[] = [];
  const rackLetters = rack.map((t) => t.letter);

  const possibleWords: string[] = [];
  for (const word of dictionary) {
    if (canMakeWord(word, rackLetters)) {
      possibleWords.push(word);
    }
  }

  // Prioritize longer words
  possibleWords.sort((a, b) => b.length - a.length);

  const boardIsEmpty = board.flat().every((sq) => !sq.tile);

  for (const word of possibleWords) {
    // Check horizontal placements
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c <= 15 - word.length; c++) {
        const placement = checkPlacement(board, rack, word, r, c, "horizontal");
        if (placement) {
          if (boardIsEmpty && (r !== 7 || c > 7 || c + word.length <= 7)) {
            continue; // First move must cross the center
          }
          const { score, words: allFormedWords } = calculateMoveScore(
            placement.tiles,
            placement.tempBoard
          );
          if (
            allFormedWords.length > 0 &&
            allFormedWords.every((w) => dictionary.has(w.word.toUpperCase()))
          ) {
            suggestions.push({ word, tiles: placement.tiles, score });
          }
        }
      }
    }

    // Check vertical placements
    for (let r = 0; r <= 15 - word.length; r++) {
      for (let c = 0; c < 15; c++) {
        const placement = checkPlacement(board, rack, word, r, c, "vertical");
        if (placement) {
           if (boardIsEmpty && (c !== 7 || r > 7 || r + word.length <= 7)) {
            continue; // First move must cross the center
          }
          const { score, words: allFormedWords } = calculateMoveScore(
            placement.tiles,
            placement.tempBoard
          );
          if (
            allFormedWords.length > 0 &&
            allFormedWords.every((w) => dictionary.has(w.word.toUpperCase()))
          ) {
            suggestions.push({ word, tiles: placement.tiles, score });
          }
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

// Helper to check if a word can be placed at a specific location
const checkPlacement = (
  board: Board,
  rack: Tile[],
  word: string,
  row: number,
  col: number,
  direction: "horizontal" | "vertical"
) => {
  let tempRack = [...rack];
  const placedTiles: PlacedTile[] = [];
  let isConnected = false;

  for (let i = 0; i < word.length; i++) {
    const r = direction === "vertical" ? row + i : row;
    const c = direction === "horizontal" ? col + i : col;
    const boardSquare = board[r]?.[c];
    if (!boardSquare) return null; // Off board

    const boardTile = boardSquare.tile;
    const wordChar = word[i];

    if (boardTile) {
      if (boardTile.letter !== wordChar) {
        return null; // Mismatch with existing tile
      }
      isConnected = true;
    } else {
      // Check for adjacent tiles to confirm connection
      if (
        (r > 0 && board[r - 1]?.[c]?.tile) ||
        (r < 14 && board[r + 1]?.[c]?.tile) ||
        (c > 0 && board[r]?.[c - 1]?.tile) ||
        (c < 14 && board[r]?.[c + 1]?.tile)
      ) {
        isConnected = true;
      }
      
      const rackIndex = tempRack.findIndex((t) => t.letter === wordChar);
      let tileToPlace: Tile;

      if (rackIndex !== -1) {
        tileToPlace = tempRack.splice(rackIndex, 1)[0];
      } else {
        const blankIndex = tempRack.findIndex((t) => t.letter === " ");
        if (blankIndex !== -1) {
          tileToPlace = {
            ...tempRack.splice(blankIndex, 1)[0],
            letter: wordChar,
            originalLetter: " ",
          };
        } else {
          return null; // Letter not available in rack
        }
      }
      placedTiles.push({ ...tileToPlace, x: r, y: c });
    }
  }

  if (placedTiles.length === 0) return null; // Word must use at least one rack tile
  
  const boardIsEmpty = board.flat().every(sq => !sq.tile);
  if (!isConnected && !boardIsEmpty) return null; // Must connect to existing tiles if board is not empty

  if (boardIsEmpty) {
      const centerCrossed = placedTiles.some(t => t.x === 7 && t.y === 7);
      if (!centerCrossed) return null;
  }


  const tempBoard = JSON.parse(JSON.stringify(board));
  placedTiles.forEach((tile) => {
    tempBoard[tile.x][tile.y].tile = tile;
  });

  return { tiles: placedTiles, tempBoard };
};

export async function replacePlayerWithComputer(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  const gameData = await getGameState(gameId);
  if (!gameData) {
    return { success: false, error: "Game not found." };
  }

  let { gameState, sha } = gameData;
  const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { success: false, error: "Player not found." };
  }

  const isCurrentTurn = getCurrentPlayer(gameState)?.id === playerId;

  if (!isCurrentTurn) {
    return {
      success: false,
      error: "It is not this player's turn to be replaced.",
    };
  }

  const lastActivityTimestamp =
    gameState.history.length > 0
      ? new Date(gameState.history[gameState.history.length - 1].timestamp)
      : gameState.createdAt
      ? new Date(gameState.createdAt)
      : null;

  if (!lastActivityTimestamp && gameState.history.length > 0) {
    return {
      success: false,
      error: "Cannot determine game start time for inactivity check.",
    };
  }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (
    lastActivityTimestamp &&
    lastActivityTimestamp > thirtyMinutesAgo &&
    gameState.history.length > 0
  ) {
    return {
      success: false,
      error: "Player has not been inactive for 30 minutes.",
    };
  }

  const newGameState = JSON.parse(JSON.stringify(gameState));
  const playerToReplace = newGameState.players[playerIndex];
  playerToReplace.isComputer = true;

  try {
    const message = `SYSTEM: Replaced player ${playerToReplace.name} with a computer.`;
    await updateGame(gameId, newGameState, sha, message);

    // Since it's their turn, immediately play a move
    const computer = playerToReplace;
    // We need to fetch the game again to get the new sha after the first update
    const updatedGameData = await getGameState(gameId);
    if (!updatedGameData) {
      throw new Error("Failed to refetch game state before AI move.");
    }

    await playTurn({
      gameId,
      player: computer,
      move: { type: "pass" }, // Pass here, the playTurn logic will handle the AI move
    });

    return { success: true };
  } catch (e: any) {
    console.error("Error during player replacement and AI move:", e);
    return { success: false, error: e.message || "Failed to update game." };
  }
}

const getWordsFromBoard = (board: Board): string[] => {
  const words = new Set<string>();
  for (let i = 0; i < 15; i++) {
    let currentHorizontalWord = "";
    let currentVerticalWord = "";
    for (let j = 0; j < 15; j++) {
      // Horizontal
      if (board[i][j].tile) {
        currentHorizontalWord += board[i][j].tile!.letter;
      } else {
        if (currentHorizontalWord.length > 1) {
          words.add(currentHorizontalWord);
        }
        currentHorizontalWord = "";
      }
      // Vertical
      if (board[j][i].tile) {
        currentVerticalWord += board[j][i].tile!.letter;
      } else {
        if (currentVerticalWord.length > 1) {
          words.add(currentVerticalWord);
        }
        currentVerticalWord = "";
      }
    }
    if (currentHorizontalWord.length > 1) words.add(currentHorizontalWord);
    if (currentVerticalWord.length > 1) words.add(currentVerticalWord);
  }
  return Array.from(words);
};

const checkAndEndGame = async (gameState: GameState): Promise<GameState> => {
  const { players, history, tileBag, board } = gameState;
  const numPlayers = players.length;

  if (numPlayers === 0 || gameState.gamePhase === "ended") return gameState;

  let newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
  let gameEnded = false;

  const playerWithEmptyRack = players.find((p) => p.rack.length === 0);
  if (tileBag.length === 0 && playerWithEmptyRack) {
    gameEnded = true;
    newGameState.gamePhase = "ended";

    let pointsFromRacks = 0;
    newGameState.players.forEach((p: Player) => {
      const rackValue = p.rack.reduce((sum, tile) => sum + tile.points, 0);
      if (p.id !== playerWithEmptyRack.id) {
        p.score -= rackValue;
        pointsFromRacks += rackValue;
      }
    });

    const finishingPlayer = newGameState.players.find(
      (p: Player) => p.id === playerWithEmptyRack.id
    )!;
    finishingPlayer.score += pointsFromRacks;
    const winners = newGameState.players.filter(
      (p: Player) =>
        p.score ===
        Math.max(...newGameState.players.map((p: Player) => p.score))
    );
    newGameState.endStatus = `${winners.map((w) => w.name).join(" & ")} wins!`;
  } else if (history.length >= numPlayers * 2) {
    const lastMoves = history.slice(-numPlayers * 2);
    if (lastMoves.every((move) => move.isPass)) {
      gameEnded = true;
      newGameState.gamePhase = "ended";
      newGameState.players.forEach((p: Player) => {
        const rackValue = p.rack.reduce((sum, tile) => sum + tile.points, 0);
        p.score -= rackValue;
      });
      const winners = newGameState.players.filter(
        (p: Player) =>
          p.score ===
          Math.max(...newGameState.players.map((p: Player) => p.score))
      );
      newGameState.endStatus = `Game ended after 2 rounds of passes. ${winners
        .map((w) => w.name)
        .join(" & ")} wins!`;
    }
  }

  if (gameEnded && !newGameState.crosswordTitle) {
    try {
      const wordsOnBoard = getWordsFromBoard(board);
      if (wordsOnBoard.length > 0) {
        const { title } = await generateCrosswordTitle({ words: wordsOnBoard });
        newGameState.crosswordTitle = title;
      }
    } catch (error) {
      console.error("Failed to generate crossword title:", error);
      // Don't block game end if title generation fails
    }
  }

  return newGameState;
};

export async function generateAndSaveCrosswordTitle(
  gameId: string
): Promise<string | null> {
  const gameData = await getGameState(gameId);
  if (!gameData || gameData.gameState.crosswordTitle) {
    return gameData?.gameState.crosswordTitle || null;
  }

  const { gameState, sha } = gameData;
  const wordsOnBoard = getWordsFromBoard(gameState.board);

  if (wordsOnBoard.length === 0) {
    return null;
  }

  try {
    const { title } = await generateCrosswordTitle({ words: wordsOnBoard });
    if (title) {
      const newGameState = { ...gameState, crosswordTitle: title };
      await updateGame(
        gameId,
        newGameState,
        sha,
        `SYSTEM: Added crossword title for game ${gameId}`
      );
      return title;
    }
  } catch (error) {
    console.error("Failed to generate and save crossword title:", error);
  }

  return null;
}

const getCurrentPlayer = (gameState: GameState): Player | null => {
  if (!gameState || gameState.players.length === 0) return null;
  const turnsPlayed = gameState.history.length;
  if (turnsPlayed < gameState.players.length) {
    const playedPlayerIds = new Set(gameState.history.map((h) => h.playerId));
    const waitingPlayers = gameState.players.filter(
      (p) => !playedPlayerIds.has(p.id)
    );
    if (waitingPlayers.length > 0) return waitingPlayers[0];
  }
  return gameState.players[turnsPlayed % gameState.players.length];
};

type PlayTurnOptions = {
  gameId: string;
  player: Player;
  move:
    | {
        type: "play";
        tiles: PlacedTile[];
      }
    | {
        type: "swap";
        tiles: Tile[];
      }
    | {
        type: "pass";
      };
};

export async function addPlayer(
  gameId: string,
  playerName: string,
  playerCode: string
): Promise<{ success: boolean; error?: string; player?: Player }> {
  const gameData = await getGameState(gameId);
  if (!gameData) {
    return { success: false, error: "Game not found." };
  }
  const { gameState, sha } = gameData;
  const { players, tileBag } = gameState;

  if (players.length >= 4) {
    return { success: false, error: "Game is full." };
  }

  const newTileBag = [...tileBag];
  const newPlayerTiles = newTileBag.splice(0, 7);

  const newPlayer: Player = {
    id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: playerName,
    code: playerCode,
    score: 0,
    rack: newPlayerTiles,
  };

  const newGameState: GameState = {
    ...gameState,
    players: [...players, newPlayer],
    tileBag: shuffle(newTileBag),
  };

  try {
    const message = `feat: Player ${playerName} joined game ${gameId}`;
    await updateGame(gameId, newGameState, sha, message);
    return { success: true, player: newPlayer };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to add player." };
  }
}

export async function playTurn({
  gameId,
  player,
  move,
}: PlayTurnOptions): Promise<{ success: boolean; error?: string }> {
  const gameData = await getGameState(gameId);
  if (!gameData) {
    return { success: false, error: "Game not found." };
  }

  let { gameState, sha } = gameData;
  let message = "";

  const applyMove = async (
    gs: GameState,
    p: Player,
    m: PlayTurnOptions["move"]
  ): Promise<GameState | { error: string }> => {
    const playerIndex = gs.players.findIndex((pl) => pl.id === p.id);
    if (playerIndex === -1) return { error: "Player not found" };

    const playerToUpdate = gs.players[playerIndex];
    let newGameState: GameState = JSON.parse(JSON.stringify(gs));
    const playerToUpdateInNewState = newGameState.players[playerIndex];

    if (m.type === "play") {
      const tempBoard = createInitialBoard();
      // Reconstruct board state from history for accurate scoring
      newGameState.history.forEach((h) =>
        h.tiles.forEach((t) => {
          if (tempBoard[t.x]?.[t.y]) tempBoard[t.x][t.y].tile = t;
        })
      );

      const { score, words, isBingo } = calculateMoveScore(m.tiles, tempBoard);

      const mainWord =
        words.find((w) =>
          w.tiles.some(
            (t) =>
              "letter" in t &&
              m.tiles.find((mt) => mt.x === t.x && mt.y === t.y)
          )
        ) || words[0];

      if (!mainWord) return { error: "Invalid move." };

      message = `feat: ${p.name} played ${mainWord.word} for ${score} points in game ${gameId}`;
      playerToUpdateInNewState.score += score;

      m.tiles.forEach((tile) => {
        if (newGameState.board[tile.x]?.[tile.y]) {
          newGameState.board[tile.x][tile.y].tile = tile;
        }
      });

      const tilesToDrawCount = m.tiles.length;
      const newTiles = newGameState.tileBag.splice(0, tilesToDrawCount);

      let rackAfterPlay = [...playerToUpdate.rack];
      const playedTileIds = new Set(m.tiles.map((t) => t.id));

      rackAfterPlay = rackAfterPlay.filter((t) => !playedTileIds.has(t.id));

      playerToUpdateInNewState.rack = [...rackAfterPlay, ...newTiles];

      const moveEvent: PlayedWord = {
        playerId: p.id,
        playerName: p.name,
        word: mainWord.word,
        tiles: m.tiles,
        score,
        timestamp: new Date().toISOString(),
      };
      newGameState.history.push(moveEvent);
    } else if (m.type === "swap") {
      message = `feat: ${p.name} swapped ${m.tiles.length} tiles in game ${gameId}`;
      const tileBag = newGameState.tileBag;
      const tileIdsToSwap = new Set(m.tiles.map((t) => t.id));
      let rackAfterSwap = [...playerToUpdate.rack];
      const swappedOutTiles: Tile[] = [];

      rackAfterSwap = rackAfterSwap.filter((t) => {
        if (tileIdsToSwap.has(t.id)) {
          swappedOutTiles.push(t);
          return false;
        }
        return true;
      });

      const newTiles = tileBag.splice(0, swappedOutTiles.length);
      playerToUpdateInNewState.rack = [...rackAfterSwap, ...newTiles];
      newGameState.tileBag = shuffle([...tileBag, ...swappedOutTiles]);

      const swapEvent: PlayedWord = {
        playerId: p.id,
        playerName: p.name,
        word: "[SWAP]",
        tiles: [],
        score: 0,
        isSwap: true,
        timestamp: new Date().toISOString(),
      };
      newGameState.history.push(swapEvent);
    } else if (m.type === "pass") {
      message = `feat: ${p.name} passed in game ${gameId}`;
      const passEvent: PlayedWord = {
        playerId: p.id,
        playerName: p.name,
        word: "[PASS]",
        tiles: [],
        score: 0,
        isPass: true,
        timestamp: new Date().toISOString(),
      };
      newGameState.history.push(passEvent);
    }

    return await checkAndEndGame(newGameState);
  };

  // Only apply human move if it's not a pass from an AI replacement scenario
  if (!(player.isComputer && move.type === "pass")) {
    let humanMoveResult = await applyMove(gameState, player, move);
    if ("error" in humanMoveResult) {
      return { success: false, error: humanMoveResult.error };
    }
    gameState = humanMoveResult;
  }

  try {
    let currentPlayer = getCurrentPlayer(gameState);
    while (currentPlayer?.isComputer && gameState.gamePhase === "playing") {
      const computer = currentPlayer;
      const suggestions = await getWordSuggestions(
        gameState.board,
        computer.rack
      );

      let computerMove: PlayTurnOptions["move"] | null = null;

      if (suggestions.length > 0) {
        // AI plays the highest scoring move
        computerMove = { type: "play", tiles: suggestions[0].tiles };
      }

      if (!computerMove) {
        if (gameState.tileBag.length > 0) {
          const tilesToSwapCount = Math.min(7, gameState.tileBag.length);
          const tilesToSwap = [...computer.rack]
            .sort((a, b) => b.points - a.points)
            .slice(0, tilesToSwapCount);
          computerMove = { type: "swap", tiles: tilesToSwap };
        } else {
          computerMove = { type: "pass" };
        }
      }

      let result = await applyMove(gameState, computer, computerMove);
      if ("error" in result) {
        console.error("AI move failed:", result.error);
        break;
      }
      gameState = result;
      currentPlayer = getCurrentPlayer(gameState);
    }

    await updateGame(gameId, gameState, sha, message);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

    