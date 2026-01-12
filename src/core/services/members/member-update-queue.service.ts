import { MemberDataService } from "@/core/services/members/member-data.service";
import { VerifyAllUsersService } from "@/core/services/members/verify-users.service";
import { bot } from "@/main";
import { prisma } from "@/prisma";
import { error, log } from "console";

const PROCESS_INTERVAL_MS = 1000;

export class MemberUpdateQueueService {
  private static processorInterval: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  static queueMemberUpdate(memberId: string, guildId: string, priority = 0) {
    prisma.memberUpdateQueue
      .upsert({
        where: { memberId_guildId: { memberId, guildId } },
        create: { memberId, guildId, priority },
        update: { priority },
      })
      .catch(() => {});
  }

  static start() {
    if (this.processorInterval) return;

    this.processorInterval = setInterval(() => {
      this.processNextItem().catch((err) => {
        error("Queue processor error:", err);
      });
    }, PROCESS_INTERVAL_MS);

    log("Member update queue processor started");
  }

  private static async processNextItem() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const item = await prisma.memberUpdateQueue.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (!item) return;

      if (VerifyAllUsersService.isVerificationRunning(item.guildId)) return;

      const deleteItem = () =>
        prisma.memberUpdateQueue
          .delete({ where: { id: item.id } })
          .catch(() => {});

      const guild = bot.guilds.cache.get(item.guildId);
      if (!guild) {
        await deleteItem();
        return;
      }

      let member;
      try {
        member = await guild.members.fetch(item.memberId);
      } catch {
        await prisma.memberGuild.updateMany({
          where: { memberId: item.memberId, guildId: item.guildId },
          data: { status: false },
        });
        await deleteItem();
        return;
      }

      await MemberDataService.updateCompleteMemberData(member);
      await deleteItem();
    } catch (err) {
      error(`Failed to process queue item:`, err);
    } finally {
      this.isProcessing = false;
    }
  }
}
