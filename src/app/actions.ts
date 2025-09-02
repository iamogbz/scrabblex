

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
import { Board, BoardSquare, GameState, PlacedTile, Player, Tile, PlayedWord } from "@/types";
import { calculateMoveScore } from "@/lib/scoring";
import { createInitialBoard, TILE_BAG } from "@/lib/game-data";
import { shuffle } from "@/lib/utils";

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
    console.error("Failed to verify word due to word set loading error:", error);
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

export async function getWordDefinition(
  word: string,
  forceRefresh = false
): Promise<string | null> {
  const upperCaseWord = word.toUpperCase();

  // In-memory cache check
  if (!forceRefresh && definitionCache.has(upperCaseWord)) {
    return definitionCache.get(upperCaseWord)!;
  }
  if (forceRefresh) {
    definitionCache.delete(upperCaseWord);
  }

  // GitHub cache check
  if (!forceRefresh) {
    const cachedDefinition = await getDictionaryWord(upperCaseWord);
    if (cachedDefinition) {
      definitionCache.set(upperCaseWord, cachedDefinition);
      return cachedDefinition;
    }
  }

  // Verification and API call
  if (!genAI) {
    console.log("GEMINI_API_KEY not set, skipping definition lookup.");
    return "GEMINI_API_KEY not set.";
  }
  if (word.length < 2) {
    return null;
  }
  const invalidWord = "Not a valid Scrabble word.";
  const unableToDefine = "Unable to define this word.";
  const { isValid } = await verifyWordAction(upperCaseWord);
  if (!isValid) {
    return invalidWord;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `Provide a concise, one-line definition for the Scrabble word "${upperCaseWord}", prepended with its language of origin in parentheses. Your response must not include the word "${upperCaseWord}" itself. If you cannot provide a definition, your entire response must be only the exact phrase "${unableToDefine}". Example: (Latin) A type of cheese.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const definition = response.text();

  console.log(`Definition for "${upperCaseWord}":`, definition);

  if (definition && !definition.includes(unableToDefine)) {
    definitionCache.set(upperCaseWord, definition);
    await updateDictionaryWord(upperCaseWord, definition);
  }

  return definition;
}

export async function getWordDefinitions(
  words: string[]
): Promise<Record<string, string | null>> {
  const upperCaseWords = words.map((w) => w.toUpperCase());
  const results: Record<string, string> = {};
  let wordsToFetchFromApi: string[] = [];

  // Check in-memory cache first
  const wordsNotInMemCache: string[] = [];
  for (const word of upperCaseWords) {
    if (definitionCache.has(word)) {
      results[word] = definitionCache.get(word)!;
    } else {
      wordsNotInMemCache.push(word);
    }
  }

  if (wordsNotInMemCache.length > 0) {
    // Check GitHub cache for the remaining words
    const githubCachedDefinitions = await getDictionaryWords(
      wordsNotInMemCache
    );

    for (const word of wordsNotInMemCache) {
      if (githubCachedDefinitions[word]) {
        results[word] = githubCachedDefinitions[word];
        definitionCache.set(word, githubCachedDefinitions[word]!);
      } else {
        wordsToFetchFromApi.push(word);
      }
    }
  }

  if (wordsToFetchFromApi.length === 0) {
    console.log("All definitions found in cache.");
    return results;
  }

  if (!genAI) {
    console.log("GEMINI_API_KEY not set, skipping definition lookup.");
    for (const word of wordsToFetchFromApi) {
      results[word] = "GEMINI_API_KEY not set.";
    }
    return results;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const unableToDefine = "Unable to define this word.";

  const prompt = `
    You are a dictionary expert. For each of the Scrabble words provided, give a concise, one-line definition, prepended with its language of origin in parentheses.
    Pay close attention to whether the word is singular or plural and phrase the definition accordingly.
    **Crucially, the definition must not contain the word itself.**
    Your response must be only a valid JSON object where the key is the uppercase word and the value is its definition string.
    If you are unable to define a word, use the exact phrase "${unableToDefine}" as its value. Do not include any other text, explanations, or markdown formatting in your response.

    Example Request: ["DOG", "CAT"]
    Example Response: {"DOG":"(Proto-Germanic) A domesticated carnivorous mammal.","CAT":"(Late Latin) A small domesticated carnivorous mammal with soft fur."}

    Words: ${JSON.stringify(wordsToFetchFromApi)}
  `;

  try {
    const generationResult = await model.generateContent(prompt);
    const responseText = generationResult.response.text();
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const definitionsFromApi = JSON.parse(jsonString) as Record<string, string>;
    const definitionsToCacheInGithub: Record<string, string> = {};

    for (const word of wordsToFetchFromApi) {
      const definition = definitionsFromApi[word];
      if (definition && !definition.includes(unableToDefine)) {
        results[word] = definition;
        definitionCache.set(word, definition);
        definitionsToCacheInGithub[word] = definition;
      } else {
        results[word] = unableToDefine;
      }
    }

    if (Object.keys(definitionsToCacheInGithub).length > 0) {
      await updateDictionaryWords(definitionsToCacheInGithub);
    }
  } catch (error) {
    console.error("Failed to fetch or parse batch definitions:", error);
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

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
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
  const anchors = findAnchors(board);
  const rackLetters = rack.map((t) => t.letter);

  for (const anchor of anchors) {
    if (
      anchor.y === 0 ||
      !board[anchor.x]?.[anchor.y - 1] ||
      !board[anchor.x][anchor.y - 1].tile
    ) {
      let prefix = "";
      for (let i = anchor.y - 1; i >= 0; i--) {
        const tile = board[anchor.x]?.[i]?.tile;
        if (tile) {
          prefix = tile.letter + prefix;
        } else {
          break;
        }
      }
      generateMoves(
        board,
        rackLetters,
        anchor.x,
        anchor.y,
        "horizontal",
        dictionary,
        suggestions,
        prefix
      );
    }
    if (
      anchor.x === 0 ||
      !board[anchor.x - 1]?.[anchor.y] ||
      !board[anchor.x - 1][anchor.y].tile
    ) {
      let prefix = "";
      for (let i = anchor.x - 1; i >= 0; i--) {
        const tile = board[i]?.[anchor.y]?.tile;
        if (tile) {
          prefix = tile.letter + prefix;
        } else {
          break;
        }
      }
      generateMoves(
        board,
        rackLetters,
        anchor.x,
        anchor.y,
        "vertical",
        dictionary,
        suggestions,
        prefix
      );
    }
  }

  const uniqueSuggestions = Array.from(
    new Map(
      suggestions.map((s) => [`${s.word}-${s.x}-${s.y}-${s.direction}`, s])
    ).values()
  );

  return uniqueSuggestions.sort((a, b) => b.score - a.score);
}

function findAnchors(board: BoardSquare[][]): { x: number; y: number }[] {
  if (!board || board.length === 0) return [];
  const anchors = new Set<string>();
  let hasTiles = false;

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (board[r]?.[c]?.tile) {
        hasTiles = true;
      } else {
        if (
          (r > 0 && board[r - 1]?.[c]?.tile) ||
          (r < 14 && board[r + 1]?.[c]?.tile) ||
          (c > 0 && board[r]?.[c - 1]?.tile) ||
          (c < 14 && board[r]?.[c + 1]?.tile)
        ) {
          anchors.add(`${r},${c}`);
        }
      }
    }
  }

  if (!hasTiles) {
    return [{ x: 7, y: 7 }];
  }

  return Array.from(anchors).map((s) => {
    const [x, y] = s.split(",").map(Number);
    return { x, y };
  });
}

function generateMoves(
  board: Board,
  rack: string[],
  x: number,
  y: number,
  direction: "horizontal" | "vertical",
  dictionary: Set<string>,
  suggestions: WordSuggestion[],
  prefix: string
) {
  extend(
    board,
    rack,
    x,
    y,
    direction,
    dictionary,
    suggestions,
    prefix,
    [],
    x,
    y
  );
}

function extend(
  board: Board,
  rack: string[],
  x: number,
  y: number,
  direction: "horizontal" | "vertical",
  dictionary: Set<string>,
  suggestions: WordSuggestion[],
  currentWord: string,
  placed: PlacedTile[],
  startX: number,
  startY: number
) {
  if (direction === "horizontal" ? y >= 15 : x >= 15) {
    validateAndAdd(
      board,
      dictionary,
      suggestions,
      currentWord,
      placed,
      startX,
      startY,
      direction
    );
    return;
  }

  const square = board[x]?.[y];
  if (square?.tile) {
    const nextX = direction === "vertical" ? x + 1 : x;
    const nextY = direction === "horizontal" ? y + 1 : y;
    extend(
      board,
      rack,
      nextX,
      nextY,
      direction,
      dictionary,
      suggestions,
      currentWord + square.tile.letter,
      placed,
      startX,
      startY
    );
  } else {
    validateAndAdd(
      board,
      dictionary,
      suggestions,
      currentWord,
      placed,
      startX,
      startY,
      direction
    );

    for (let i = 0; i < rack.length; i++) {
      const letter = rack[i];
      const remainingRack = [...rack.slice(0, i), ...rack.slice(i + 1)];
      const newPlaced = [
        ...placed,
        {
          letter,
          points: TILE_BAG.find(t => t.letter === letter)?.points ?? 0,
          x,
          y,
          originalLetter: letter === " " ? " " : undefined,
        },
      ];
      const nextX = direction === "vertical" ? x + 1 : x;
      const nextY = direction === "horizontal" ? y + 1 : y;

      if (letter === " ") {
        for (let charCode = 65; charCode <= 90; charCode++) {
          const char = String.fromCharCode(charCode);
          newPlaced[newPlaced.length - 1].letter = char;
          newPlaced[newPlaced.length - 1].points = 0;
          extend(
            board,
            remainingRack,
            nextX,
            nextY,
            direction,
            dictionary,
            suggestions,
            currentWord + char,
            newPlaced,
            startX,
            startY
          );
        }
      } else {
        extend(
          board,
          remainingRack,
          nextX,
          nextY,
          direction,
          dictionary,
          suggestions,
          currentWord + letter,
          newPlaced,
          startX,
startY
        );
      }
    }
  }
}

function validateAndAdd(
  board: Board,
  dictionary: Set<string>,
  suggestions: WordSuggestion[],
  word: string,
  placedTiles: PlacedTile[],
  startX: number,
  startY: number,
  direction: "horizontal" | "vertical"
) {
  if (placedTiles.length === 0 || !dictionary.has(word.toUpperCase())) {
    return;
  }

  const isConnected =
    board.flat().some(square => square.tile) === false || // First move
    placedTiles.some(tile => {
      const { x, y } = tile;
      return (
        (x > 0 && board[x - 1]?.[y]?.tile) ||
        (x < 14 && board[x + 1]?.[y]?.tile) ||
        (y > 0 && board[x]?.[y - 1]?.tile) ||
        (y < 14 && board[x]?.[y + 1]?.tile)
      );
    });

  if (!isConnected) {
    return;
  }

  const tempBoard = JSON.parse(JSON.stringify(board));
  placedTiles.forEach((tile) => {
    if (tempBoard[tile.x]?.[tile.y]) {
      tempBoard[tile.x][tile.y].tile = tile;
    }
  });

  const { score, words: allFormedWords } = calculateMoveScore(
    placedTiles,
    tempBoard
  );

  const areAllWordsValid =
    allFormedWords.length > 0 &&
    allFormedWords.every((w) => dictionary.has(w.word.toUpperCase()));

  if (areAllWordsValid) {
    const mainWordInfo = allFormedWords.find((w) => w.word.toUpperCase() === word.toUpperCase());

    if (mainWordInfo) {
      const firstTile = mainWordInfo.tiles.sort((a,b) => ("y" in a ? a.y : Infinity) - ("y" in b ? b.y : Infinity) || ("x" in a ? a.x : Infinity) - ("x" in b ? b.x : Infinity))[0] as PlacedTile;
      suggestions.push({
        word: mainWordInfo.word,
        tiles: placedTiles,
        score,
        direction: mainWordInfo.direction,
        x: firstTile.x,
        y: firstTile.y,
      });
    }
  }
}

export async function replacePlayerWithComputer(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  const gameData = await getGameState(gameId);
  if (!gameData) {
    return { success: false, error: "Game not found." };
  }

  const { gameState, sha } = gameData;
  const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { success: false, error: "Player not found." };
  }

  const turnsPlayed = gameState.history.length;
  const currentPlayerIndex = turnsPlayed % gameState.players.length;

  if (gameState.players[currentPlayerIndex].id !== playerId) {
    return { success: false, error: "It is not this player's turn." };
  }

  const lastMoveTimestamp =
    gameState.history.length > 0
      ? new Date(gameState.history[gameState.history.length - 1].timestamp)
      : new Date(0);

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  if (lastMoveTimestamp > thirtyMinutesAgo && gameState.history.length > 0) {
    return {
      success: false,
      error: "Player has not been inactive for 30 minutes.",
    };
  }

  const newGameState = JSON.parse(JSON.stringify(gameState));
  newGameState.players[playerIndex].isComputer = true;

  try {
    await updateGame(
      gameId,
      newGameState,
      sha,
      `SYSTEM: Replaced player ${gameState.players[playerIndex].name} with a computer.`
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to update game." };
  }
}

const checkAndEndGame = (gameState: GameState): GameState => {
    const { players, history, tileBag } = gameState;
    const numPlayers = players.length;

    if (numPlayers === 0 || gameState.gamePhase === "ended") return gameState;

    const playerWithEmptyRack = players.find((p) => p.rack.length === 0);
    if (tileBag.length === 0 && playerWithEmptyRack) {
      const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
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
        (p: Player) => p.score === Math.max(...newGameState.players.map((p: Player) => p.score))
      );
      newGameState.endStatus = `${winners.map(w => w.name).join(' & ')} wins!`;
      return newGameState;
    }

    if (history.length >= numPlayers * 2) {
      const lastMoves = history.slice(-numPlayers * 2);
      if (lastMoves.every((move) => move.isPass)) {
        const newGameState: GameState = JSON.parse(JSON.stringify(gameState));
        newGameState.gamePhase = "ended";
        newGameState.players.forEach((p: Player) => {
          const rackValue = p.rack.reduce((sum, tile) => sum + tile.points, 0);
          p.score -= rackValue;
        });
        const winners = newGameState.players.filter(
          (p: Player) => p.score === Math.max(...newGameState.players.map((p: Player) => p.score))
        );
        newGameState.endStatus = `Game ended after 2 rounds of passes. ${winners.map(w => w.name).join(' & ')} wins!`;
        return newGameState;
      }
    }

    return gameState;
};

const getCurrentPlayer = (gameState: GameState): Player | null => {
    if (!gameState || gameState.players.length === 0) return null;
    const turnsPlayed = gameState.history.length;
    if (turnsPlayed < gameState.players.length) {
      const playedPlayerIds = new Set(gameState.history.map((h) => h.playerId));
      const waitingPlayers = gameState.players.filter(p => !playedPlayerIds.has(p.id));
      if (waitingPlayers.length > 0) return waitingPlayers[0];
    }
    return gameState.players[turnsPlayed % gameState.players.length];
};

type PlayTurnOptions = {
    gameId: string;
    player: Player;
    move: {
        type: 'play';
        tiles: PlacedTile[];
    } | {
        type: 'swap';
        tiles: Tile[];
    } | {
        type: 'pass';
    };
};

export async function addPlayer(gameId: string, playerName: string, playerCode: string): Promise<{ success: boolean; error?: string; player?: Player }> {
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

export async function playTurn({ gameId, player, move }: PlayTurnOptions): Promise<{success: boolean; error?: string}> {
    const gameData = await getGameState(gameId);
    if (!gameData) {
        return { success: false, error: "Game not found." };
    }

    let { gameState, sha } = gameData;
    let message = "";

    const applyMove = (gs: GameState, p: Player, m: PlayTurnOptions['move']): GameState | { error: string } => {
        const playerIndex = gs.players.findIndex(pl => pl.id === p.id);
        if (playerIndex === -1) return { error: "Player not found" };

        const playerToUpdate = gs.players[playerIndex];
        const newGameState: GameState = JSON.parse(JSON.stringify(gs));
        const playerToUpdateInNewState = newGameState.players[playerIndex];

        if (m.type === 'play') {
            const { score, words, isBingo } = calculateMoveScore(m.tiles, gs.board);
            const mainWord = words.find(w => w.tiles.some(t => "letter" in t && m.tiles.find(mt => mt.x === t.x && mt.y === t.y))) || words[0];

            if (!mainWord) return { error: "Invalid move." };

            message = `feat: ${p.name} played ${mainWord.word} for ${score} points in game ${gameId}`;
            playerToUpdateInNewState.score += score;

            const tilesToDrawCount = m.tiles.length;
            const newTiles = newGameState.tileBag.splice(0, tilesToDrawCount);

            let rackAfterPlay = [...playerToUpdate.rack];
            const playedLetters = m.tiles.map(t => t.originalLetter ?? t.letter);

            playedLetters.forEach(letter => {
                const indexToRemove = rackAfterPlay.findIndex(t => t.letter === letter);
                if (indexToRemove > -1) rackAfterPlay.splice(indexToRemove, 1);
            });

            playerToUpdateInNewState.rack = [...rackAfterPlay, ...newTiles];

            const moveEvent: PlayedWord = {
                playerId: p.id,
                playerName: p.name,
                word: mainWord.word,
                tiles: m.tiles,
                score,
                timestamp: new Date().toISOString()
            };
            newGameState.history.push(moveEvent);
        } else if (m.type === 'swap') {
            message = `feat: ${p.name} swapped ${m.tiles.length} tiles in game ${gameId}`;
            const tileBag = newGameState.tileBag;
            const lettersToSwap = m.tiles.map(t => t.letter);
            const rackAfterSwap = [...playerToUpdate.rack];
            const swappedOutTiles: Tile[] = [];

            lettersToSwap.forEach(letter => {
                const index = rackAfterSwap.findIndex(t => t.letter === letter);
                if (index > -1) swappedOutTiles.push(rackAfterSwap.splice(index, 1)[0]);
            });

            const newTiles = tileBag.splice(0, swappedOutTiles.length);
            playerToUpdateInNewState.rack = [...rackAfterSwap, ...newTiles];
            newGameState.tileBag = shuffle([...tileBag, ...swappedOutTiles]);

            const swapEvent: PlayedWord = {
                playerId: p.id, playerName: p.name, word: '[SWAP]', tiles: [], score: 0, isSwap: true, timestamp: new Date().toISOString()
            };
            newGameState.history.push(swapEvent);
        } else if (m.type === 'pass') {
            message = `feat: ${p.name} passed in game ${gameId}`;
            const passEvent: PlayedWord = {
                playerId: p.id, playerName: p.name, word: '[PASS]', tiles: [], score: 0, isPass: true, timestamp: new Date().toISOString()
            };
            newGameState.history.push(passEvent);
        }

        newGameState.board = createInitialBoard();
        newGameState.history.forEach(h => {
          if(h.tiles) {
            h.tiles.forEach(t => {
                if (newGameState.board[t.x]?.[t.y]) newGameState.board[t.x][t.y].tile = t;
            })
          }
        });

        return checkAndEndGame(newGameState);
    }

    let humanMoveResult = applyMove(gameState, player, move);
    if ("error" in humanMoveResult) {
        return { success: false, error: humanMoveResult.error };
    }
    gameState = humanMoveResult;

    try {
        let currentPlayer = getCurrentPlayer(gameState);
        while(currentPlayer?.isComputer && gameState.gamePhase === 'playing') {
            const computer = currentPlayer;
            const suggestions = await getWordSuggestions(gameState.board, computer.rack);

            let computerMove: PlayTurnOptions['move'];
            if (suggestions.length > 0) {
                computerMove = { type: 'play', tiles: suggestions[0].tiles };
            } else if (gameState.tileBag.length > 0) {
                const tilesToSwapCount = Math.min(7, gameState.tileBag.length);
                const tilesToSwap = [...computer.rack].sort((a,b) => b.points - a.points).slice(0, tilesToSwapCount);
                computerMove = { type: 'swap', tiles: tilesToSwap };
            } else {
                computerMove = { type: 'pass' };
            }

            let result = applyMove(gameState, computer, computerMove);
            if ("error" in result) {
                 // Log error and break loop
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
