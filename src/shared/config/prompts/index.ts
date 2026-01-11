import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

interface PromptConfig {
  name: string;
  description: string;
  system: string;
}

function loadPrompt(name: string): PromptConfig {
  const filePath = join(__dirname, `${name}.yaml`);
  const content = readFileSync(filePath, "utf-8");
  return parse(content) as PromptConfig;
}

export const CHAT_PROMPT = loadPrompt("chat");
export const SPAM_PROMPT = loadPrompt("spam");

export function getChatSystemPrompt(): string {
  return CHAT_PROMPT.system;
}

export function getSpamSystemPrompt(): string {
  return SPAM_PROMPT.system;
}
