import type { APIEmbed } from "discord.js";
import { BOT_ICON, RED_COLOR } from "@/shared/config/branding";
import { BOARD_TEMPLATES } from "@/shared/ai/prompts";
import type { ValidatedBoardType } from "@/shared/ai/prompts";
import type { TemplateValidationResult } from "@/types";

interface TemplateValidationDmParams {
  postTitle: string;
  boardType: ValidatedBoardType;
  result: TemplateValidationResult;
}

interface TemplateValidationNotificationParams {
  memberId: string;
  postTitle: string;
  boardType: ValidatedBoardType;
  missingFields: string[];
}

function buildPreFilledTemplate(
  boardType: ValidatedBoardType,
  extractedFields: Record<string, string>,
): string {
  const board = BOARD_TEMPLATES[boardType];
  const lines = board.fields.map((field) => {
    const value = extractedFields[field];
    return `**${field}:** ${value || "[FILL IN]"}`;
  });
  return lines.join("\n");
}

export const templateValidationDmEmbed = (
  params: TemplateValidationDmParams,
): APIEmbed => {
  const board = BOARD_TEMPLATES[params.boardType];
  const preFilledTemplate = buildPreFilledTemplate(
    params.boardType,
    params.result.extractedFields,
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
