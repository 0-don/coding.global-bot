import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProvider,
} from "@ai-sdk/google";
import { botLogger } from "@/lib/telemetry";
import { APICallError, RetryError } from "ai";

type RawModelId = Parameters<GoogleGenerativeAIProvider>[0];
type ModelId = RawModelId extends infer T
  ? T extends string
    ? string extends T
      ? never
      : T
    : never
  : never;

const FALLBACK_MODELS: ModelId[] = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
]

function getApiKeys() {
  const keys =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.split(",").map((k) => k.trim()) ||
    [];
  // Shuffle once at startup so different instances don't all hit the same key first
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

function createGoogleProviders() {
  const keys = getApiKeys();
  return keys.map((apiKey) => createGoogleGenerativeAI({ apiKey }));
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return "***";
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

function getAPICallError(error: unknown): InstanceType<typeof APICallError> | null {
  if (APICallError.isInstance(error)) return error;
  if (RetryError.isInstance(error) && APICallError.isInstance(error.lastError)) {
    return error.lastError;
  }
  return null;
}

type ErrorCategory = "rate_limit" | "key_error" | "non_retryable" | "unknown";

function categorizeError(error: unknown): ErrorCategory {
  const apiError = getAPICallError(error);

  if (apiError) {
    // HTTP status-based detection
    if (apiError.statusCode === 429) return "rate_limit";
    if (apiError.statusCode === 403) return "key_error";
    if (apiError.statusCode === 404) return "non_retryable";
    if (apiError.statusCode === 400) return "non_retryable";

    // Response body-based detection for ambiguous status codes
    const body = apiError.responseBody || "";
    if (body.includes("RESOURCE_EXHAUSTED") || body.includes("rateLimitExceeded")) return "rate_limit";
    if (body.includes("API_KEY_INVALID") || body.includes("PERMISSION_DENIED")) return "key_error";
  }

  // Fallback to message-based detection
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("quota") || message.includes("overloaded") ||
      message.includes("The model is overloaded")) return "rate_limit";

  if (message.includes("API_KEY_INVALID") || message.includes("API key not valid") ||
      message.includes("PERMISSION_DENIED")) return "key_error";

  if (message.includes("Failed to download") || message.includes("INVALID_ARGUMENT")) return "non_retryable";

  return "unknown";
}

class GoogleClientRotator {
  private providers = createGoogleProviders();
  private currentKeyIndex = 0;
  private currentModelIndex = 0;

  getModel(modelName?: string) {
    const model = modelName || FALLBACK_MODELS[this.currentModelIndex];
    return this.providers[this.currentKeyIndex](model);
  }

  private rotateKey() {
    if (this.providers.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.providers.length;
      botLogger.info("Rotated API key", {
        keyIndex: this.currentKeyIndex + 1,
        totalKeys: this.providers.length,
      });
    }
  }

  private rotateModel(): boolean {
    const nextModelIndex = this.currentModelIndex + 1;
    if (nextModelIndex < FALLBACK_MODELS.length) {
      this.currentModelIndex = nextModelIndex;
      botLogger.info("Rotated model", {
        model: FALLBACK_MODELS[this.currentModelIndex],
        modelIndex: this.currentModelIndex + 1,
        totalModels: FALLBACK_MODELS.length,
      });
      return true;
    }
    return false;
  }

  async executeWithRotation<T>(
    operation: (model: ReturnType<GoogleClientRotator["getModel"]>) => Promise<T>,
  ): Promise<T | null> {
    if (this.providers.length === 0) {
      botLogger.error("No API keys configured");
      return null;
    }

    const startModelIndex = this.currentModelIndex;
    const startKeyIndex = this.currentKeyIndex;
    let lastError: unknown;
    let lastCategory: ErrorCategory = "unknown";

    botLogger.info("Starting AI request", {
      model: FALLBACK_MODELS[this.currentModelIndex],
      keyIndex: this.currentKeyIndex + 1,
      totalKeys: this.providers.length,
    });

    do {
      const keyStartIndex = this.currentKeyIndex;

      do {
        try {
          const model = this.getModel();
          const result = await operation(model);
          // Treat empty text responses as failures - continue rotating
          const hasContent = result && typeof result === "object" && "text" in result
            ? !!(result as { text?: string }).text?.trim()
            : !!result;
          if (!hasContent) {
            botLogger.warn("Empty response, rotating", {
              model: FALLBACK_MODELS[this.currentModelIndex],
            });
            this.rotateKey();
            continue;
          }
          botLogger.info("AI request succeeded", {
            model: FALLBACK_MODELS[this.currentModelIndex],
          });
          return result;
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          lastCategory = categorizeError(error);

          botLogger.error("AI error", {
            model: FALLBACK_MODELS[this.currentModelIndex],
            keyIndex: this.currentKeyIndex + 1,
            category: lastCategory,
            message,
          });

          if (lastCategory === "non_retryable") {
            botLogger.warn("Non-retryable error, stopping");
            return null;
          }

          if (lastCategory === "key_error") {
            const expiredKey = getApiKeys()[this.currentKeyIndex];
            if (expiredKey) {
              botLogger.warn("API key invalid", { key: maskApiKey(expiredKey) });
            }
          }

          this.rotateKey();
        }
      } while (this.currentKeyIndex !== keyStartIndex);

      // All keys exhausted for this model
      // If last error was key_error, don't try other models (same keys will fail)
      if (lastCategory === "key_error") {
        botLogger.warn("All keys invalid, stopping");
        this.currentModelIndex = startModelIndex;
        this.currentKeyIndex = startKeyIndex;
        return null;
      }

      // Try next model for rate_limit or unknown errors
      if (!this.rotateModel()) {
        this.currentModelIndex = startModelIndex;
        this.currentKeyIndex = startKeyIndex;
        break;
      }
      this.currentKeyIndex = 0;
    } while (this.currentModelIndex !== startModelIndex);

    botLogger.warn("All models and keys exhausted", {
      totalModels: FALLBACK_MODELS.length,
      totalKeys: this.providers.length,
    });
    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    botLogger.error("Last error", { message: finalMessage });

    return null;
  }
}

export const googleClient = new GoogleClientRotator();
