import type { APIEmbed } from "discord.js";
import { BOT_ICON, RED_COLOR } from "@/shared/config/branding";
import { BOARD_TEMPLATES } from "@/shared/ai/prompts";
import type { ValidatedBoardType } from "@/shared/ai/prompts";
import { botLogger } from "@/lib/telemetry";
import type { TemplateValidationResult } from "@/types";

interface TemplateValidationDmParams {
  postTitle: string;
  boardType: ValidatedBoardType;
  postContent: string;
  result: TemplateValidationResult;
}

interface TemplateValidationNotificationParams {
  memberId: string;
  postTitle: string;
  boardType: ValidatedBoardType;
  missingFields: string[];
}

function findExtractedValue(
  field: string,
  extractedFields: Record<string, string>,
): string | undefined {
  if (extractedFields[field]) return extractedFields[field];

  const fieldLower = field.toLowerCase();
  for (const [key, value] of Object.entries(extractedFields)) {
    if (key.toLowerCase() === fieldLower) return value;
    if (
      key.toLowerCase().includes(fieldLower) ||
      fieldLower.includes(key.toLowerCase())
    )
      return value;
  }
  return undefined;
}

function extractFieldsFromContent(
  boardType: ValidatedBoardType,
  postContent: string,
  postTitle: string,
): Record<string, string> {
  const extracted: Record<string, string> = {};
  const board = BOARD_TEMPLATES[boardType];
  const lines = postContent.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const field of board.fields) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
    // Match variations: **Field:** val, **Field**: val, **Field** : val, Field: val
    const patterns = [
      new RegExp(`\\*\\*${escaped}\\s*:\\*\\*\\s*(.+)`, "i"),
      new RegExp(`\\*\\*${escaped}\\*\\*\\s*:?\\s*(.+)`, "i"),
      new RegExp(`${escaped}\\s*:\\s*(.+)`, "i"),
    ];

    for (const line of lines) {
      let matched = false;
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match?.[1]?.trim()) {
          extracted[field] = match[1].trim();
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }

  if (boardType === "job-board" && !extracted["Project Title"] && postTitle) {
    extracted["Project Title"] = postTitle;
  }

  botLogger.info("[TemplateValidation] Regex extraction result", {
    boardType,
    contentLines: lines.length,
    extractedKeys: Object.keys(extracted),
    extracted
  });

  return extracted;
}

function buildPreFilledTemplate(
  boardType: ValidatedBoardType,
  extractedFields: Record<string, string>,
): string {
  const board = BOARD_TEMPLATES[boardType];
  const lines = board.fields.map((field) => {
    const value = findExtractedValue(field, extractedFields);
    return `**${field}:** ${value || "[FILL IN]"}`;
  });
  return lines.join("\n");
}

export const templateValidationDmEmbed = (
  params: TemplateValidationDmParams,
): APIEmbed => {
  const board = BOARD_TEMPLATES[params.boardType];

  const aiFields = params.result.extractedFields;
  const regexFields = extractFieldsFromContent(
    params.boardType,
    params.postContent,
    params.postTitle,
  );

  // Merge: regex first, AI overwrites (AI is more accurate when it works)
  const enrichedFields = { ...regexFields, ...aiFields };

  if (
    params.boardType === "job-board" &&
    !findExtractedValue("Project Title", enrichedFields)
  ) {
    enrichedFields["Project Title"] = params.postTitle;
  }

  botLogger.info("[TemplateValidation] Building DM embed", {
    aiFieldCount: Object.keys(aiFields).length,
    regexFieldCount: Object.keys(regexFields).length,
    mergedFieldCount: Object.keys(enrichedFields).length,
    mergedFieldKeys: Object.keys(enrichedFields),
  });

  const preFilledTemplate = buildPreFilledTemplate(
    params.boardType,
    enrichedFields,
  );

  const fields: APIEmbed["fields"] = [
    {
      name: "Missing Information",
      value: params.result.missingFields.map((f) => `• ${f}`).join("\n"),
      inline: false,
    },
  ];

  if (params.result.suggestions) {
    fields.push({
      name: "Suggestions",
      value: params.result.suggestions,
      inline: false,
    });
  }

  fields.push({
    name: "Template (copy and fill in)",
    value: `\`\`\`\n${preFilledTemplate}\n\`\`\``,
    inline: false,
  });

  return {
    color: RED_COLOR,
    title: "Post Removed: Missing Required Information",
    description: `Your post **"${params.postTitle}"** in the **${board.label}** was removed because it is missing required information.\n\nPlease repost with the missing fields filled in.`,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: board.label,
      icon_url: BOT_ICON,
    },
  };
};

export const templateValidationNotificationEmbed = (
  params: TemplateValidationNotificationParams,
): APIEmbed => {
  const board = BOARD_TEMPLATES[params.boardType];

  return {
    color: RED_COLOR,
    title: `Post Removed from ${board.label}`,
    description: [
      `**User:** <@${params.memberId}>`,
      `**Post:** ${params.postTitle}`,
      `**Missing:** ${params.missingFields.join(", ")}`,
    ].join("\n"),
    timestamp: new Date().toISOString(),
    footer: {
      text: board.label,
      icon_url: BOT_ICON,
    },
  };
};
