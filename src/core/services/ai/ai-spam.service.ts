import { buildSpamContextText, SPAM_SYSTEM_PROMPT } from "@/shared/ai/prompts";
import { googleClient, ImageDownloadError } from "@/shared/integrations/google-ai";
import { botLogger } from "@/lib/telemetry";
import type { SpamDetectionContext, SpamDetectionResult } from "@/types";
import { generateText, Output } from "ai";
import { z } from "zod";

export class AiSpamService {
  static async analyzeForSpam(
    context: SpamDetectionContext,
    images: string[],
  ): Promise<SpamDetectionResult | null> {
    const contextText = buildSpamContextText(context);

    const buildMessages = (imgs: string[]) => [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: contextText },
          ...imgs.map((url) => ({
            type: "image" as const,
            image: url,
          })),
        ],
      },
    ];

    const runAI = (msgs: ReturnType<typeof buildMessages>) =>
      googleClient.executeWithRotation(async (model) => {
        return await generateText({
          model,
          system: SPAM_SYSTEM_PROMPT,
          messages: msgs,
          output: Output.object({
            schema: z.object({
              isSpam: z.boolean(),
              confidence: z.enum(["high", "medium", "low"]),
              reason: z.string(),
            }),
          }),
          temperature: 0.1,
          maxRetries: 0,
        });
      });

    let result;
    try {
      result = await runAI(buildMessages(images));
    } catch (error) {
      if (error instanceof ImageDownloadError) {
        botLogger.warn("Retrying spam analysis without images");
        result = await runAI(buildMessages([]));
      } else {
        throw error;
      }
    }

    if (!result) {
      return null;
    }

    try {
      return result.output;
    } catch {
      return null;
    }
  }
}
