import { ThreadService } from "@/core/services/threads/thread.service";
import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { AiTemplateService } from "@/core/services/ai/ai-template.service";
import type { ValidatedBoardType } from "@/shared/ai/prompts";
import { db } from "@/lib/db";
import { thread } from "@/lib/db-schema";
import { eq, and } from "drizzle-orm";
import { ForumChannel, ThreadChannel } from "discord.js";
import { Elysia, status, t } from "elysia";
import { guildDerive } from "../middleware/guild.derive";

const VALIDATED_BOARDS: ValidatedBoardType[] = ["job-board", "dev-board", "showcase"];

const adminGuard = new Elysia({ name: "admin-guard" })
  .derive(({ headers }) => {
    const key = process.env.ADMIN_API_KEY;
    if (!key) throw status("Internal Server Error", "ADMIN_API_KEY not configured");

    const auth = headers.authorization;
    if (!auth || auth !== `Bearer ${key}`) {
      throw status("Unauthorized", "Invalid or missing API key");
    }

    return {};
  })
  .as("global");

export const adminRoutes = new Elysia()
  .use(guildDerive)
  .use(adminGuard)
  // Delete a specific thread by ID (from Discord and DB)
  .delete(
    "/api/:guildId/admin/thread/:threadId",
    async ({ params, guild, query }) => {
      const reason = query.reason || "Removed via admin API";

      const channel = guild.channels.cache.get(params.threadId)
        ?? await guild.channels.fetch(params.threadId).catch(() => null);

      if (channel?.isThread()) {
        await channel.delete(reason).catch(() => {});
      }

      await ThreadService.deleteThread(params.threadId);

      return { deleted: true, threadId: params.threadId, reason };
    },
    {
      params: t.Object({ guildId: t.String(), threadId: t.String() }),
      query: t.Object({ reason: t.Optional(t.String()) }),
    },
  )
  // Jail a user by member ID
  .post(
    "/api/:guildId/admin/jail/:memberId",
    async ({ params, guild, body }) => {
      const reason = body.reason || "Jailed via admin API";

      const discordMember = guild.members.cache.get(params.memberId)
        ?? await guild.members.fetch(params.memberId).catch(() => null);

      await DeleteUserMessagesService.deleteUserMessages({
        guild,
        user: discordMember?.user || null,
        memberId: params.memberId,
        jail: true,
        reason,
      });

      return { jailed: true, memberId: params.memberId, reason };
    },
    {
      params: t.Object({ guildId: t.String(), memberId: t.String() }),
      body: t.Object({ reason: t.Optional(t.String()) }),
    },
  )
  // Validate a specific thread against current rules (does not delete)
  .get(
    "/api/:guildId/admin/validate/:threadId",
    async ({ params, guild }) => {
      const channel = guild.channels.cache.get(params.threadId)
        ?? await guild.channels.fetch(params.threadId).catch(() => null);

      if (!channel?.isThread() || !channel.parent) {
        throw status("Not Found", "Thread not found");
      }

      const boardType = ThreadService.getThreadTypeFromChannel(
        channel.parent as ForumChannel,
      );

      if (!VALIDATED_BOARDS.includes(boardType as ValidatedBoardType)) {
        return { threadId: params.threadId, boardType, validation: null, note: "Not a validated board type" };
      }

      const starterMessage = await (channel as ThreadChannel).fetchStarterMessage().catch(() => null);
      if (!starterMessage?.content?.trim()) {
        return { threadId: params.threadId, boardType, validation: null, note: "No starter message content" };
      }

      const parent = channel.parent as ForumChannel;
      const availableTagNames = parent.availableTags.map((t) => t.name);
      const appliedTagNames = (channel as ThreadChannel).appliedTags
        .map((tagId) => parent.availableTags.find((t) => t.id === tagId)?.name)
        .filter(Boolean) as string[];

      const result = await AiTemplateService.validatePost(
        boardType as ValidatedBoardType,
        channel.name,
        starterMessage.content,
        appliedTagNames,
        availableTagNames,
      );

      return {
        threadId: params.threadId,
        threadName: channel.name,
        authorId: (channel as ThreadChannel).ownerId,
        boardType,
        content: starterMessage.content.slice(0, 500),
        validation: result,
      };
    },
    {
      params: t.Object({ guildId: t.String(), threadId: t.String() }),
    },
  )
  // Bulk validate all threads in a board (validate only)
  .get(
    "/api/:guildId/admin/validate-board/:boardType",
    async ({ params, guild }) => {
      const boardType = params.boardType;

      const threads = await db.query.thread.findMany({
        where: and(eq(thread.guildId, params.guildId), eq(thread.boardType, boardType)),
        columns: { id: true, name: true, authorId: true },
      });

      const results: Array<{
        threadId: string;
        threadName: string;
        authorId: string | null;
        isValid: boolean | null;
        missingFields: string[];
        scamRisk: string;
        scamReason: string;
        summary: string;
      }> = [];

      for (const t of threads) {
        const channel = guild.channels.cache.get(t.id)
          ?? await guild.channels.fetch(t.id).catch(() => null);

        if (!channel?.isThread()) {
          results.push({
            threadId: t.id,
            threadName: t.name,
            authorId: t.authorId,
            isValid: null,
            missingFields: [],
            scamRisk: "unknown",
            scamReason: "Thread not accessible on Discord",
            summary: "",
          });
          continue;
        }

        const starterMessage = await (channel as ThreadChannel).fetchStarterMessage().catch(() => null);
        if (!starterMessage?.content?.trim()) {
          results.push({
            threadId: t.id,
            threadName: t.name,
            authorId: t.authorId,
            isValid: null,
            missingFields: [],
            scamRisk: "unknown",
            scamReason: "No starter message",
            summary: "",
          });
          continue;
        }

        const parent = channel.parent as ForumChannel;
        const availableTagNames = parent?.availableTags.map((tag) => tag.name) || [];
        const appliedTagNames = (channel as ThreadChannel).appliedTags
          .map((tagId) => parent?.availableTags.find((tag) => tag.id === tagId)?.name)
          .filter(Boolean) as string[];

        const result = await AiTemplateService.validatePost(
          boardType as ValidatedBoardType,
          channel.name,
          starterMessage.content,
          appliedTagNames,
          availableTagNames,
        );

        results.push({
          threadId: t.id,
          threadName: t.name,
          authorId: t.authorId,
          isValid: result?.isValid ?? null,
          missingFields: result?.missingFields || [],
          scamRisk: result?.scamRisk || "unknown",
          scamReason: result?.scamReason || "",
          summary: result?.summary || "",
        });
      }

      return {
        boardType,
        total: results.length,
        valid: results.filter((r) => r.isValid === true).length,
        invalid: results.filter((r) => r.isValid === false).length,
        unknown: results.filter((r) => r.isValid === null).length,
        threads: results,
      };
    },
    {
      params: t.Object({ guildId: t.String(), boardType: t.String() }),
    },
  );
