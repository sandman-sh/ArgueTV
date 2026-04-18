// @ts-nocheck
import OpenAI from "openai";

if (!process.env.OPENROUTER_BASE_URL) {
  throw new Error(
    "OPENROUTER_BASE_URL must be set. Did you forget to configure OpenRouter?",
  );
}

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error(
    "OPENROUTER_API_KEY must be set. Did you forget to configure OpenRouter?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL,
});

