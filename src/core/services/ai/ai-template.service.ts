import {
  TEMPLATE_VALIDATION_SYSTEM_PROMPT,
  buildTemplateContextText,
} from "@/shared/ai/prompts";
import type { ValidatedBoardType } from "@/shared/ai/prompts";
import { googleClient } from "@/shared/integrations/google-ai";
import type { TemplateValidationResult } from "@/types";
import { generateText, Output } from "ai";
import { z } from "zod";

const templateValidationSchema = z.object({
  isValid: z.boolean(),
  missingFields: z.array(z.string()),
  suggestions: z.string(),
  extractedFields: z.record(z.string(), z.string()),
});

export class AiTemplateService {
  static async validatePost(
    boardType: ValidatedBoardType,
    postTitle: string,
    postContent: string,
    appliedTagNames: string[],
    availableTagNames: string[],
  ): Promise<TemplateValidationResult | null> {
    const contextText = buildTemplateContextText(
      boardType,
      postTitle,
      postContent,
      appliedTagNames,
      availableTagNames,
    );

    const result = await googleClient.executeWithRotation(async (model) => {
      return await generateText({
        model,
        system: TEMPLATE_VALIDATION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: contextText }],
          },
        ],
        output: Output.object({
          schema: templateValidationSchema,
        }),
        temperature: 0.1,
        maxRetries: 0,
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
