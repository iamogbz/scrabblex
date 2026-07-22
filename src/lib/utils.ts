import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  INVALID_WORD_ERROR,
  NO_API_KEY_ERROR,
  UNDEFINED_WORD_VALID,
} from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const isValidDefinition = (definition: string): boolean => {
  return ![INVALID_WORD_ERROR, NO_API_KEY_ERROR, UNDEFINED_WORD_VALID].includes(
    definition
  );
};
