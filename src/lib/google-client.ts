import {
  createGoogleGenerativeAI,
  GoogleGenerativeAIProvider,
} from "@ai-sdk/google";
import { log } from "console";

function createGoogleProviders() {
  const keys =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.split(",").map((k) => k.trim()) ||
    [];

  if (keys.length === 0) {
    throw new Error("No Google AI API keys configured");
  }

  return keys.map((apiKey) => createGoogleGenerativeAI({ apiKey }));
}

class GoogleClientRotator {
  private providers = createGoogleProviders();
  private currentIndex = 0;

  getModel(
    modelName: Parameters<GoogleGenerativeAIProvider>[0] = "gemini-3-flash-preview",
  ) {
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

  async executeWithRotation<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
  ): Promise<T> {
    const retries = maxRetries || this.providers.length;
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `AI error (attempt ${attempt + 1}/${retries}): ${message}`,
        );

        if (this.shouldRotateOnError(error) && attempt < retries - 1) {
          this.rotate();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else if (attempt < retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
        }
      }
    }

    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`All AI attempts failed. Last error: ${finalMessage}`);
    throw lastError;
  }
}

export const googleClient = new GoogleClientRotator();
