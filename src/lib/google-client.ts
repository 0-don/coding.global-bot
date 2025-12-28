import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

export class CircuitBreakerOpen extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpen";
  }
}

class GoogleClientRotator {
  private providers = createGoogleProviders();
  private currentIndex = 0;

  // Circuit breaker state
  private circuitOpen = false;
  private circuitOpenedAt: number | null = null;
  private consecutiveFailures = 0;
  private readonly CIRCUIT_BREAK_THRESHOLD = 3; // Open after 3 consecutive full rotations fail
  private readonly CIRCUIT_RESET_MS = 60_000; // Try again after 60 seconds

  getModel(modelName = "gemini-2.5-flash") {
    return this.providers[this.currentIndex](modelName);
  }

  isCircuitOpen(): boolean {
    if (!this.circuitOpen) return false;

    // Check if enough time has passed to try again
    if (
      this.circuitOpenedAt &&
      Date.now() - this.circuitOpenedAt >= this.CIRCUIT_RESET_MS
    ) {
      log(
        `Circuit breaker: Attempting to reset after ${this.CIRCUIT_RESET_MS / 1000}s cooldown`,
      );
      this.circuitOpen = false;
      this.circuitOpenedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }

    return true;
  }

  private openCircuit(): void {
    this.circuitOpen = true;
    this.circuitOpenedAt = Date.now();
    console.warn(
      `Circuit breaker OPEN: All API keys exhausted. AI features disabled for ${this.CIRCUIT_RESET_MS / 1000}s`,
    );
  }

  private resetFailures(): void {
    this.consecutiveFailures = 0;
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

  private isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("RESOURCE_EXHAUSTED")
    );
  }

  async executeWithRotation<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
  ): Promise<T> {
    // Check circuit breaker first
    if (this.isCircuitOpen()) {
      throw new CircuitBreakerOpen(
        `AI temporarily disabled due to rate limiting. Retry in ${Math.ceil((this.CIRCUIT_RESET_MS - (Date.now() - (this.circuitOpenedAt || 0))) / 1000)}s`,
      );
    }

    const retries = maxRetries || this.providers.length;
    let lastError: unknown;
    let allRateLimited = true;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await operation();
        // Success - reset failure counter
        this.resetFailures();
        return result;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `AI error (attempt ${attempt + 1}/${retries}): ${message}`,
        );

        // Track if this is a rate limit error
        if (!this.isRateLimitError(error)) {
          allRateLimited = false;
        }

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

    // All retries failed
    if (allRateLimited) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.CIRCUIT_BREAK_THRESHOLD) {
        this.openCircuit();
      }
    }

    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`All AI attempts failed. Last error: ${finalMessage}`);
    throw lastError;
  }
}

export const googleClient = new GoogleClientRotator();
