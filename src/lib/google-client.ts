import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

  getModel(modelName = "gemini-2.5-flash") {
    return this.providers[this.currentIndex](modelName);
  }

  rotate() {
    if (this.providers.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % this.providers.length;
      console.log(
        `Rotated to API key ${this.currentIndex + 1}/${this.providers.length}`
      );
    }
  }

  private isKeyError(error: unknown): boolean {
    // Handle different error types
    const errorString = String(error);

    // Check error message
    if (error && typeof error === "object" && "message" in error) {
      const message = String(error.message);
      if (
        message.includes("API key expired") ||
        message.includes("API_KEY_INVALID")
      ) {
        return true;
      }
    }

    // Check responseBody for AI SDK errors
    if (error && typeof error === "object" && "responseBody" in error) {
      const responseBody = String(error.responseBody);
      if (
        responseBody.includes("API key expired") ||
        responseBody.includes("API_KEY_INVALID")
      ) {
        return true;
      }
    }

    // Fallback
    return (
      errorString.includes("API key expired") ||
      errorString.includes("API_KEY_INVALID")
    );
  }

  async executeWithRotation<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (this.isKeyError(error) && attempt < maxRetries - 1) {
          this.rotate();
        }

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
        }
      }
    }

    throw lastError;
  }
}

export const googleClient = new GoogleClientRotator();
