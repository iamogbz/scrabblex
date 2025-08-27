
/**
 * @fileoverview Service for interacting with GitHub to store and retrieve word definitions.
 */
import { GITHUB_TOKEN, GITHUB_USER_REPO, GITHUB_BRANCH_GAMES } from "./game-service";

const GITHUB_API_BASE_URL = `https://api.github.com/repos/${GITHUB_USER_REPO}/contents`;

if (!GITHUB_TOKEN) {
  console.warn(
    "GITHUB_TOKEN environment variable is not set. Word definitions will not be cached."
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


export async function getDictionaryWord(word: string): Promise<string | null> {
    if (!GITHUB_TOKEN) return null;
    const upperCaseWord = word.toUpperCase();
    const path = `dictionary/${upperCaseWord}.txt`;

    try {
        const response = await fetch(`${GITHUB_API_BASE_URL}/${path}?ref=${GITHUB_BRANCH_GAMES}`, {
            headers: githubHeaders,
            cache: "no-store", // We want the freshest definition
        });

        if (response.status === 404) {
            return null; // File doesn't exist
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch definition for ${upperCaseWord}: ${response.statusText}`);
        }

        const data = await response.json();
        return fromBase64(data.content);

    } catch (error) {
        console.error(`Error getting dictionary word "${upperCaseWord}":`, error);
        return null;
    }
}

export async function updateDictionaryWord(word: string, definition: string): Promise<void> {
    if (!GITHUB_TOKEN) return;
    const upperCaseWord = word.toUpperCase();
    const path = `dictionary/${upperCaseWord}.txt`;
    
    try {
        // First, check if the file exists to get its SHA
        let sha: string | undefined;
        try {
            const getResponse = await fetch(`${GITHUB_API_BASE_URL}/${path}?ref=${GITHUB_BRANCH_GAMES}`, {
                headers: githubHeaders,
            });
            if (getResponse.ok) {
                const data = await getResponse.json();
                sha = data.sha;
            } else if (getResponse.status !== 404) {
                throw new Error(`GitHub API error on get: ${getResponse.statusText}`);
            }
        } catch (e) {
            // It is fine if we cannot find the sha
        }

        const content = toBase64(definition);
        const message = sha ? `feat: Update definition for ${upperCaseWord}` : `feat: Create definition for ${upperCaseWord}`;
        
        const body: {
            message: string;
            content: string;
            branch: string;
            sha?: string;
        } = {
            message,
            content,
            branch: GITHUB_BRANCH_GAMES,
        };

        if (sha) {
            body.sha = sha;
        }

        const putResponse = await fetch(`${GITHUB_API_BASE_URL}/${path}`, {
            method: 'PUT',
            headers: { ...githubHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!putResponse.ok) {
            const error = await putResponse.json();
            throw new Error(`Failed to update definition for ${upperCaseWord}: ${error.message}`);
        }

    } catch (error) {
        console.error(`Error updating dictionary word "${upperCaseWord}":`, error);
        // We don't re-throw, as failing to cache shouldn't break the game flow.
    }
}

export async function getDictionaryWords(words: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    const promises = words.map(async (word) => {
        const definition = await getDictionaryWord(word);
        results[word.toUpperCase()] = definition;
    });
    await Promise.all(promises);
    return results;
}

export async function updateDictionaryWords(definitions: Record<string, string>): Promise<void> {
    const promises = Object.entries(definitions).map(([word, definition]) => 
        updateDictionaryWord(word, definition)
    );
    await Promise.all(promises);
}
