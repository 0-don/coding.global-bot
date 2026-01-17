import { buildSpamContextText, SPAM_SYSTEM_PROMPT } from "@/shared/ai/prompts";
import { googleClient } from "@/shared/integrations/google-ai";
import type { SpamDetectionContext, SpamDetectionResult } from "@/types";
import { generateText, Output } from "ai";
import { z } from "zod";

export class AiSpamService {
  static async analyzeForSpam(
    context: SpamDetectionContext,
    images: string[],
  ): Promise<SpamDetectionResult | null> {
    const contextText = buildSpamContextText(context);

    const result = await googleClient.executeWithRotation(async () => {
      return await generateText({
        model: googleClient.getModel(),
        system: SPAM_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: contextText },
              ...images.map((url) => ({
                type: "image" as const,
                image: url,
              })),
            ],
          },
        ],
        output: Output.object({
          schema: z.object({
            isSpam: z.boolean(),
            confidence: z.enum(["high", "medium", "low"]),
            reason: z.string(),
          }),
        }),
        temperature: 0.1,
      });
    });

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
