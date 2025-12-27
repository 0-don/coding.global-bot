import { error, log } from "console";
import { bot } from "../../main";
import { prisma } from "../../prisma";
import { updateCompleteMemberData } from "./member-data.service";
import { isVerificationRunning } from "./verify-all-users";

let processorInterval: NodeJS.Timeout | null = null;

const PROCESS_INTERVAL_MS = 100;

export function queueMemberUpdate(
  memberId: string,
  guildId: string,
  priority = 0,
) {
  prisma.memberUpdateQueue
    .upsert({
      where: { memberId_guildId: { memberId, guildId } },
      create: { memberId, guildId, priority },
      update: { priority },
    })
    .catch((err) => {
      error(`Failed to queue member update for ${memberId}:`, err);
    });
}

export function startMemberUpdateQueue() {
  if (processorInterval) return;

  processorInterval = setInterval(() => {
    processNextItem().catch((err) => {
      error("Queue processor error:", err);
    });
  }, PROCESS_INTERVAL_MS);

  log("Member update queue processor started");
}

async function processNextItem() {
  const item = await prisma.memberUpdateQueue.findFirst({
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  if (!item) return;

  if (isVerificationRunning(item.guildId)) return;

  const deleteItem = () =>
    prisma.memberUpdateQueue.deleteMany({ where: { id: item.id } });

  try {
    const guild = bot.guilds.cache.get(item.guildId);
    if (!guild) {
      await deleteItem();
      return;
    }

    let member;
    try {
      member = await guild.members.fetch(item.memberId);
    } catch {
      await deleteItem();
      return;
    }

    await updateCompleteMemberData(member);

    await deleteItem();
  } catch (err) {
    error(`Failed to process queue item for member ${item.memberId}:`, err);
    await deleteItem();
  }
}
