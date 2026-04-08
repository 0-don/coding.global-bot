import { ThreadService } from "@/core/services/threads/thread.service";
import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { Elysia, status, t } from "elysia";
import { guildDerive } from "../middleware/guild.derive";

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
  );
