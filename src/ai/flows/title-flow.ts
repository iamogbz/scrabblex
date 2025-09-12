"use server";
/**
 * @fileOverview A flow for generating a crossword puzzle title from a list of words.
 *
 * - generateCrosswordTitle - A function that handles the title generation process.
 * - TitleInput - The input type for the generateCrosswordTitle function.
 * - TitleOutput - The return type for the generateCrosswordTitle function.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const TitleInputSchema = z.object({
  words: z.array(z.string()).describe("A list of words from the puzzle."),
});
export type TitleInput = z.infer<typeof TitleInputSchema>;

const TitleOutputSchema = z.object({
  title: z
    .string()
    .describe(
      "A 1-2 word thematic title for the puzzle based on the words."
    ),
});
export type TitleOutput = z.infer<typeof TitleOutputSchema>;

export async function generateCrosswordTitle(
  input: TitleInput
): Promise<TitleOutput> {
  return generateCrosswordTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: "crosswordTitlePrompt",
  input: { schema: TitleInputSchema },
  output: { schema: TitleOutputSchema },
  prompt: `You are an expert puzzle maker. Based on the following list of words from a completed crossword puzzle, generate a short, clever, and thematic title for the puzzle. The title should be 1 or 2 words long.

Words:
{{#each words}}
- {{{this}}}
{{/each}}
`,
});

const generateCrosswordTitleFlow = ai.defineFlow(
  {
    name: "generateCrosswordTitleFlow",
    inputSchema: TitleInputSchema,
    outputSchema: TitleOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
