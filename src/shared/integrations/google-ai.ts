import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { log } from "console";

function getApiKeys() {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.split(",").map((k) => k.trim()) ||
    []
  );
}

function createGoogleProviders() {
  const keys = getApiKeys();
  return keys.map((apiKey) => createGoogleGenerativeAI({ apiKey }));
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return "***";
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

class GoogleClientRotator {
  private providers = createGoogleProviders();
  private currentIndex = 0;

  getModel(modelName = "gemini-2.5-flash") {
    return this.providers[this.currentIndex](modelName);
  }

  rotate() {
    if (this.providers.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % this.providers.length;
      log(
        `Rotated to API key ${this.currentIndex + 1}/${this.providers.length}`,
      );
    }
  }

  private shouldRotateOnError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    return (
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("API key") ||
      message.includes("API_KEY_INVALID") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("overloaded") ||
      message.includes("The model is overloaded") ||
      message.includes("Please try again later")
    );
  }

  async executeWithRotation<T>(operation: () => Promise<T>): Promise<T | null> {
    const maxAttempts = this.providers.length;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `AI error (attempt ${attempt + 1}/${maxAttempts}): ${message}`,
        );

        if (this.shouldRotateOnError(error) && attempt < maxAttempts - 1) {
          const expiredKey = getApiKeys()[this.currentIndex];
          if (expiredKey) {
            log(`API key expired/failed: ${maskApiKey(expiredKey)}`);
          }
          this.rotate();
        }
      }
    }

    // All keys exhausted for this request
    console.warn(
      `All ${this.providers.length} API keys exhausted. Request failed.`,
    );
    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`Last error: ${finalMessage}`);

    return null;
  }
}

export const googleClient = new GoogleClientRotator();
