'use server';

/**
 * @fileOverview Implements a Genkit flow to verify if a word is valid using an LLM-based tool.
 *
 * - verifyWord - A function that handles the word verification process.
 * - VerifyWordInput - The input type for the verifyWord function.
 * - VerifyWordOutput - The return type for the verifyWord function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VerifyWordInputSchema = z.object({
  word: z.string().describe('The word to verify.'),
});

export type VerifyWordInput = z.infer<typeof VerifyWordInputSchema>;

const VerifyWordOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the word is a valid word or not.'),
});

export type VerifyWordOutput = z.infer<typeof VerifyWordOutputSchema>;

export async function verifyWord(input: VerifyWordInput): Promise<VerifyWordOutput> {
  return verifyWordFlow(input);
}

const verifyWordPrompt = ai.definePrompt({
  name: 'verifyWordPrompt',
  input: {schema: VerifyWordInputSchema},
  output: {schema: VerifyWordOutputSchema},
  prompt: `You are a word expert. Determine if the word '{{word}}' is a valid English word.\nReturn a JSON object that indicates whether the word is valid or not in the isValid field.`,
});

const verifyWordFlow = ai.defineFlow(
  {
    name: 'verifyWordFlow',
    inputSchema: VerifyWordInputSchema,
    outputSchema: VerifyWordOutputSchema,
  },
  async input => {
    const {output} = await verifyWordPrompt(input);
    return output!;
  }
);
