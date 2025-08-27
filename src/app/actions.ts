
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
  updateDictionaryWords
} from "@/lib/dictionary-service";
import { redirect } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "@octokit/rest";

let wordSet: Set<string>;
const definitionCache = new Map<string, string | null>();

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
  redirect(`/play/${gameId}`);
}

export async function getGameState(gameId: string) {
  return await getGame(gameId.toUpperCase());
}

export async function updateGameState(
  gameId: string,
  gameState: any,
  sha: string,
  message: string
) {
  await updateGame(gameId.toUpperCase(), gameState, sha, message);
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export async function getWordDefinition(word: string, forceRefresh = false): Promise<string | null> {
  const upperCaseWord = word.toUpperCase();

  // In-memory cache check
  if (!forceRefresh && definitionCache.has(upperCaseWord)) {
    return definitionCache.get(upperCaseWord)!;
  }
  if(forceRefresh) {
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
  const prompt = `Provide a concise, one-line definition for the Scrabble word "${upperCaseWord}". Your response must not include the word "${upperCaseWord}" itself. If you cannot provide a definition, your entire response must be only the exact phrase "${unableToDefine}".`;

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
  const results: Record<string, string | null> = {};
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
      const githubCachedDefinitions = await getDictionaryWords(wordsNotInMemCache);
      
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
    You are a dictionary expert. Provide a concise, one-line definition for each of the following Scrabble words.
    Pay close attention to whether the word is singular or plural and phrase the definition accordingly.
    **Crucially, the definition must not contain the word itself.**
    Your response must be only a valid JSON object where the key is the uppercase word and the value is its definition.
    If you are unable to define a word, use the exact phrase "${unableToDefine}" as its value. Do not include any other text, explanations, or markdown formatting in your response.

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
    for (const word of wordsToFetchFromApi) {
      results[word] = "Error fetching definition.";
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
  gameId: string,
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
    // 1. Get base branch to branch from
    const { data: baseBranch } = await octokit.repos.getBranch({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH_BASE,
    });
    const baseSha = baseBranch.commit.sha;

    // 2. Create a new branch
    try {
      await octokit.git.createRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
    } catch (error: any) {
      // If branch already exists, we can ignore the error.
      if (error.status !== 422) {
        // 422 is "Reference already exists"
        throw error;
      }
    }

    // 3. Get the current dictionary content
    const fileRequest = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DICTIONARY_PATH,
      ref: branchName,
    };
    const {
      // @ts-expect-error sha exists in the response data for get encoded file content
      data: { sha: fileSha },
      status: statusFileSha,
    } = await octokit.repos.getContent(fileRequest);

    // Get the file content in raw format for files between 1 and 100 MB
    const { data: fileContent, status: statusFileContent } =
      await octokit.repos.getContent({
        ...fileRequest,
        mediaType: {
          format: "raw",
        },
      });

    const currentContent = fileContent.toString().trim();

    if (!currentContent) {
      console.error({
        statusFileContent,
        statusFileSha,
        currentContent,
        fileSha,
      });
      throw new Error("Current content is empty or invalid.");
    }

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
    const newContent = Array.from(words).sort().join("\n");

    // 4. Update the dictionary file in the new branch
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: DICTIONARY_PATH,
      message: `feat: Add "${upperCaseWord}" to dictionary`,
      content: Buffer.from(newContent).toString("base64"),
      sha: fileSha,
      branch: branchName,
    });

    // 5. Create a pull request
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
