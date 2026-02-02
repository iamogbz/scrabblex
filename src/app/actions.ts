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

  if (!forceRefresh) {
    const cachedDefinition = await getDictionaryWord(upperCaseWord);
    if (cachedDefinition) {
      definitionCache.set(upperCaseWord, cachedDefinition);
      return cachedDefinition;
    }
  }

  const { isValid } = await verifyWordAction(upperCaseWord);
  if (!isValid) {
    return INVALID_WORD_ERROR;
  }

  const apiDefinition = await getDefinitionFromDictionaryAPI(upperCaseWord);
  if (apiDefinition && !apiDefinition.toUpperCase().includes(upperCaseWord)) {
    definitionCache.set(upperCaseWord, apiDefinition);
    await updateDictionaryWord(upperCaseWord, apiDefinition);
    return apiDefinition;
  }

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

    if (geminiDefinition && !geminiDefinition.includes(UNDEFINED_WORD_ERROR)) {
      definitionCache.set(upperCaseWord, geminiDefinition);
      await updateDictionaryWord(upperCaseWord, geminiDefinition);
      return geminiDefinition;
    } else {
      return UNDEFINED_WORD_VALID;
    }
  } catch (error) {
    console.error(
      `Error fetching Gemini definition for "${upperCaseWord}":`,
      error
    );
    return UNDEFINED_WORD_VALID;
  }
}

export async function getWordDefinitions(
  words: string[]
): Promise<Record<string, string | null>> {
  const upperCaseWords = words.map((w) => w.toUpperCase());
  const results: Record<string, string | null> = {};
  const wordsToFetch: string[] = [];

  for (const word of upperCaseWords) {
    if (definitionCache.has(word)) {
      results[word] = definitionCache.get(word)!;
    } else {
      wordsToFetch.push(word);
    }
  }

  if (wordsToFetch.length === 0) return results;

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
        results[word] = UNDEFINED_WORD_VALID;
      }
    }

    if (Object.keys(geminiDefinitionsToCache).length > 0) {
      await updateDictionaryWords(geminiDefinitionsToCache);
    }
  } catch (error) {
    console.error("Failed to fetch or parse batch Gemini definitions:", error);
    for (const word of wordsForGemini) {
      results[word] = UNDEFINED_WORD_VALID;
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
  direction: "horizontal" | "vertical";
  x: number;
  y: number;
};

export async function getWordSuggestions(
  board: BoardSquare[][],
  rack: Tile[]
): Promise<WordSuggestion[]> {
  const dictionary = await getWordSet();
  const suggestions: WordSuggestion[] = [];
  
  const boardLetters = new Set<string>();
  board.flat().forEach(s => {
    if (s.tile) boardLetters.add(s.tile.letter);
  });
  const rackLetters = rack.map(t => t.letter);
  const rackCounts = getCharCounts(rackLetters);
  const hasBlank = rackLetters.includes(" ");

  const possibleWords = Array.from(dictionary)
    .filter(word => {
      const wordCounts = getCharCounts(word.split(""));
      let blanksNeeded = 0;
      for (const char in wordCounts) {
        const needed = wordCounts[char];
        const available = rackCounts[char] || 0;
        if (needed > available) {
          if (!hasBlank) return false;
          blanksNeeded += (needed - available);
        }
      }
      const totalBlanks = rackCounts[" "] || 0;
      return blanksNeeded <= totalBlanks;
    })
    .sort((a, b) => b.length - a.length);

  const anchors = findAnchors(board);

  for (const word of possibleWords) {
    if (suggestions.length >= 100) break;

    for (const anchor of anchors) {
      if (suggestions.length >= 100) break;

      const directions: ("horizontal" | "vertical")[] = ["horizontal", "vertical"];
      for (const direction of directions) {
        if (suggestions.length >= 100) break;

        for (let i = 0; i < word.length; i++) {
          const startX = direction === "horizontal" ? anchor.x : anchor.x - i;
          const startY = direction === "horizontal" ? anchor.y - i : anchor.y;

          const placement = checkPlacement(board, word, startX, startY, direction, rack);
          if (placement) {
            const tempBoard = JSON.parse(JSON.stringify(board));
            placement.forEach(tile => {
              if (tempBoard[tile.x]?.[tile.y]) tempBoard[tile.x][tile.y].tile = tile;
            });

            const { score, words: formedWords } = calculateMoveScore(placement, board);
            const allWordsValid = formedWords.every(w => dictionary.has(w.word.toUpperCase()));

            if (allWordsValid) {
              suggestions.push({
                word,
                tiles: placement,
                score,
                direction,
                x: startX,
                y: startY
              });
              if (suggestions.length >= 100) break;
            }
          }
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

function getCharCounts(chars: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const char of chars) {
    counts[char] = (counts[char] || 0) + 1;
  }
  return counts;
}

function findAnchors(board: BoardSquare[][]): { x: number; y: number }[] {
  const anchors: { x: number; y: number }[] = [];
  let boardEmpty = true;
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (board[r][c].tile) {
        boardEmpty = false;
        const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && !board[nr][nc].tile) {
            if (!anchors.some(a => a.x === nr && a.y === nc)) {
              anchors.push({ x: nr, y: nc });
            }
          }
        }
      }
    }
  }
  return boardEmpty ? [{ x: 7, y: 7 }] : anchors;
}

function checkPlacement(
  board: Board,
  word: string,
  startX: number,
  startY: number,
  direction: "horizontal" | "vertical",
  rack: Tile[]
): PlacedTile[] | null {
  if (startX < 0 || startY < 0) return null;
  const endX = direction === "horizontal" ? startX : startX + word.length - 1;
  const endY = direction === "horizontal" ? startY + word.length - 1 : startY;
  if (endX >= 15 || endY >= 15) return null;

  const placedTiles: PlacedTile[] = [];
  const usedRackTileIds = new Set<string>();
  let usesRackTile = false;

  const beforeX = direction === "vertical" ? startX - 1 : startX;
  const beforeY = direction === "horizontal" ? startY - 1 : startY;
  if (beforeX >= 0 && beforeY >= 0 && board[beforeX][beforeY].tile) return null;

  const afterX = direction === "vertical" ? endX + 1 : endX;
  const afterY = direction === "horizontal" ? endY + 1 : endY;
  if (afterX < 15 && afterY < 15 && board[afterX][afterY].tile) return null;

  for (let i = 0; i < word.length; i++) {
    const x = direction === "horizontal" ? startX : startX + i;
    const y = direction === "horizontal" ? startY + i : startY;
    const char = word[i];
    const square = board[x][y];

    if (square.tile) {
      if (square.tile.letter !== char) return null;
    } else {
      let rackTile = rack.find(t => t.letter === char && !usedRackTileIds.has(t.id));
      if (!rackTile) {
        rackTile = rack.find(t => t.letter === " " && !usedRackTileIds.has(t.id));
        if (!rackTile) return null;
        placedTiles.push({ ...rackTile, letter: char, originalLetter: " ", x, y });
      } else {
        placedTiles.push({ ...rackTile, x, y });
      }
      usedRackTileIds.add(rackTile.id);
      usesRackTile = true;
    }
  }

  return usesRackTile ? placedTiles : null;
}

export async function replacePlayerWithComputer(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  const gameData = await getGameState(gameId);
  if (!gameData) return { success: false, error: "Game not found." };

  let { gameState, sha } = gameData;
  const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { success: false, error: "Player not found." };

  const isCurrentTurn = getCurrentPlayer(gameState)?.id === playerId;
  if (!isCurrentTurn) return { success: false, error: "It is not this player's turn." };

  const lastActivityTimestamp =
    gameState.history.length > 0
      ? new Date(gameState.history[gameState.history.length - 1].timestamp)
      : gameState.createdAt
      ? new Date(gameState.createdAt)
      : null;

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (lastActivityTimestamp && lastActivityTimestamp > thirtyMinutesAgo && gameState.history.length > 0) {
    return { success: false, error: "Player not inactive long enough." };
  }

  const newGameState = JSON.parse(JSON.stringify(gameState));
  const playerToReplace = newGameState.players[playerIndex];
  playerToReplace.isComputer = true;

  try {
    const message = `SYSTEM: Replaced player ${playerToReplace.name} with AI.`;
    await updateGame(gameId, newGameState, sha, message);

    const updatedGameData = await getGameState(gameId);
    if (!updatedGameData) throw new Error("Failed to refetch game state.");

    await playTurn({
      gameId,
      player: playerToReplace,
      move: { type: "pass" },
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to update game." };
  }
}

const getWordsFromBoard = (board: Board): string[] => {
  const words = new Set<string>();
  for (let i = 0; i < 15; i++) {
    let currentHorizontalWord = "";
    let currentVerticalWord = "";
    for (let j = 0; j < 15; j++) {
      if (board[i][j].tile) currentHorizontalWord += board[i][j].tile!.letter;
      else {
        if (currentHorizontalWord.length > 1) words.add(currentHorizontalWord);
        currentHorizontalWord = "";
      }
      if (board[j][i].tile) currentVerticalWord += board[j][i].tile!.letter;
      else {
        if (currentVerticalWord.length > 1) words.add(currentVerticalWord);
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
    const finishingPlayer = newGameState.players.find((p: Player) => p.id === playerWithEmptyRack.id)!;
    finishingPlayer.score += pointsFromRacks;
    const maxScore = Math.max(...newGameState.players.map((p: Player) => p.score));
    const winners = newGameState.players.filter((p: Player) => p.score === maxScore);
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
      const maxScore = Math.max(...newGameState.players.map((p: Player) => p.score));
      const winners = newGameState.players.filter((p: Player) => p.score === maxScore);
      newGameState.endStatus = `Game ended by consecutive passes. ${winners.map((w) => w.name).join(" & ")} wins!`;
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
    }
  }

  return newGameState;
};

export async function generateAndSaveCrosswordTitle(gameId: string): Promise<string | null> {
  const gameData = await getGameState(gameId);
  if (!gameData || gameData.gameState.crosswordTitle) return gameData?.gameState.crosswordTitle || null;
  const { gameState, sha } = gameData;
  const wordsOnBoard = getWordsFromBoard(gameState.board);
  if (wordsOnBoard.length === 0) return null;
  try {
    const { title } = await generateCrosswordTitle({ words: wordsOnBoard });
    if (title) {
      const newGameState = { ...gameState, crosswordTitle: title };
      await updateGame(gameId, newGameState, sha, `SYSTEM: Added title for ${gameId}`);
      return title;
    }
  } catch (error) {
    console.error("Failed to generate and save title:", error);
  }
  return null;
}

const getCurrentPlayer = (gameState: GameState): Player | null => {
  if (!gameState || gameState.players.length === 0) return null;
  const turnsPlayed = gameState.history.filter(h => h.playerId).length;
  if (turnsPlayed < gameState.players.length) {
    const playedPlayerIds = new Set(gameState.history.map((h) => h.playerId));
    const waitingPlayers = gameState.players.filter((p) => !playedPlayerIds.has(p.id));
    if (waitingPlayers.length > 0) return waitingPlayers[0];
  }
  return gameState.players[turnsPlayed % gameState.players.length];
};

type PlayTurnOptions = {
  gameId: string;
  player: Player;
  move: { type: "play"; tiles: PlacedTile[] } | { type: "swap"; tiles: Tile[] } | { type: "pass" };
};

export async function addPlayer(gameId: string, playerName: string, playerCode: string): Promise<{ success: boolean; error?: string; player?: Player }> {
  const gameData = await getGameState(gameId);
  if (!gameData) return { success: false, error: "Game not found." };
  const { gameState, sha } = gameData;
  const { players, tileBag } = gameState;
  if (players.length >= 4) return { success: false, error: "Game is full." };
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
    await updateGame(gameId, newGameState, sha, `feat: Player ${playerName} joined`);
    return { success: true, player: newPlayer };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to add player." };
  }
}

export async function playTurn({ gameId, player, move }: PlayTurnOptions): Promise<{ success: boolean; error?: string }> {
  const gameData = await getGameState(gameId);
  if (!gameData) return { success: false, error: "Game not found." };
  let { gameState, sha } = gameData;
  let message = "";

  const applyMove = async (gs: GameState, p: Player, m: PlayTurnOptions["move"]): Promise<GameState | { error: string }> => {
    const playerIndex = gs.players.findIndex((pl) => pl.id === p.id);
    if (playerIndex === -1) return { error: "Player not found" };
    const playerToUpdateInNewState = gs.players[playerIndex];
    let newGameState: GameState = JSON.parse(JSON.stringify(gs));
    const updatedPlayer = newGameState.players[playerIndex];

    if (m.type === "play") {
      const { score, words, isBingo } = calculateMoveScore(m.tiles, gs.board);
      const mainWord = words.find((w) => w.tiles.some((t) => m.tiles.find((mt) => mt.x === t.x && mt.y === t.y))) || words[0];
      if (!mainWord) return { error: "Invalid move." };
      message = `feat: ${p.name} played ${mainWord.word} for ${score}`;
      updatedPlayer.score += score;
      m.tiles.forEach((tile) => {
        if (newGameState.board[tile.x]?.[tile.y]) newGameState.board[tile.x][tile.y].tile = tile;
      });
      const newTiles = newGameState.tileBag.splice(0, m.tiles.length);
      const playedIds = new Set(m.tiles.map(t => t.id));
      updatedPlayer.rack = [...updatedPlayer.rack.filter(t => !playedIds.has(t.id)), ...newTiles];
      newGameState.history.push({
        playerId: p.id,
        playerName: p.name,
        word: mainWord.word,
        tiles: m.tiles,
        score,
        timestamp: new Date().toISOString(),
      });
    } else if (m.type === "swap") {
      message = `feat: ${p.name} swapped ${m.tiles.length} tiles`;
      const swappedIds = new Set(m.tiles.map(t => t.id));
      const swappedOut = updatedPlayer.rack.filter(t => swappedIds.has(t.id));
      const newTiles = newGameState.tileBag.splice(0, swappedOut.length);
      updatedPlayer.rack = [...updatedPlayer.rack.filter(t => !swappedIds.has(t.id)), ...newTiles];
      newGameState.tileBag = shuffle([...newGameState.tileBag, ...swappedOut]);
      newGameState.history.push({
        playerId: p.id,
        playerName: p.name,
        word: "[SWAP]",
        tiles: [],
        score: 0,
        isSwap: true,
        timestamp: new Date().toISOString(),
      });
    } else if (m.type === "pass") {
      message = `feat: ${p.name} passed`;
      newGameState.history.push({
        playerId: p.id,
        playerName: p.name,
        word: "[PASS]",
        tiles: [],
        score: 0,
        isPass: true,
        timestamp: new Date().toISOString(),
      });
    }
    return await checkAndEndGame(newGameState);
  };

  if (!(player.isComputer && move.type === "pass")) {
    let result = await applyMove(gameState, player, move);
    if ("error" in result) return { success: false, error: result.error };
    gameState = result;
  }

  try {
    let currentPlayer = getCurrentPlayer(gameState);
    while (currentPlayer?.isComputer && gameState.gamePhase === "playing") {
      const suggestions = await getWordSuggestions(gameState.board, currentPlayer.rack);
      let aiMove: PlayTurnOptions["move"] = suggestions.length > 0 ? { type: "play", tiles: suggestions[0].tiles } : (gameState.tileBag.length > 0 ? { type: "swap", tiles: currentPlayer.rack.slice(0, Math.min(7, gameState.tileBag.length)) } : { type: "pass" });
      let result = await applyMove(gameState, currentPlayer, aiMove);
      if ("error" in result) result = await applyMove(gameState, currentPlayer, { type: "pass" });
      if ("error" in result) break;
      gameState = result;
      currentPlayer = getCurrentPlayer(gameState);
    }
    const finalData = await getGameState(gameId);
    await updateGame(gameId, gameState, finalData?.sha || sha, message);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}