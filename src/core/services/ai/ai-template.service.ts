import {
  TEMPLATE_VALIDATION_SYSTEM_PROMPT,
  buildTemplateContextText,
} from "@/shared/ai/prompts";
import type { ValidatedBoardType } from "@/shared/ai/prompts";
import { googleClient } from "@/shared/integrations/google-ai";
import type { TemplateValidationResult } from "@/types";
import { generateText, Output } from "ai";
import { z } from "zod";

// Gemini does not support z.record() in structured output (maps to
// additionalProperties which is silently ignored, always returning {}).
// Use an array of key-value pairs instead and convert back after.
const templateValidationSchema = z.object({
  isValid: z.boolean(),
  missingFields: z.array(z.string()),
  suggestions: z.string(),
  extractedFields: z.array(
    z.object({
      field: z.string(),
      value: z.string(),
    }),
  ),
  summary: z.string(),
  scamRisk: z.enum(["low", "medium", "high"]),
  scamReason: z.string(),
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
      const raw = result.output;

      // Convert array of {field, value} back to Record<string, string>
      const extractedFields: Record<string, string> = {};
      for (const entry of raw.extractedFields) {
        if (entry.field && entry.value) {
          extractedFields[entry.field] = entry.value;
        }
      }

      return {
        isValid: raw.isValid,
        missingFields: raw.missingFields,
        suggestions: raw.suggestions,
        extractedFields,
        summary: raw.summary,
        scamRisk: raw.scamRisk,
        scamReason: raw.scamReason,
      };
    } catch {
      return null;
    }
  }
}
