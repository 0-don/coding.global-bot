import type { Message } from "discord.js";
import { prisma } from "../../prisma.js";
import { deleteUserMessages } from "./deleteUserMessages.js";

export const checkWarnings = async (message: Message<boolean>) => {
  const content = message.content;
  const member = message.member;

  if (!member || !message.guild) return;

  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: member.id },
  });

  if (!memberGuild) return;

  if (
    content.includes("discord.gg/") ||
    content.includes("discordapp.com/invite/") ||
    content.includes("discord.com/invite/")
  ) {
    await message.delete();

    const currentWarnings = memberGuild.warnings + 1;

    await prisma.memberGuild.update({
      where: { id: memberGuild.id },
      data: { warnings: currentWarnings },
    });

    if (currentWarnings < 4) {
      try {
        await member.send(
          `Stop posting invites, you have been warned. Warnings: ${currentWarnings}, you will be muted at 3 warnings.`,
        );
      } catch (error) {}
    } else {
      await deleteUserMessages({
        days: 7,
        jail: true,
        memberId: member.id,
        user: member.user,
        guild: message.guild,
      });

      try {
        await member.send(`You have been muted asks a mod to unmute you.`);
      } catch (error) {}
    }
  }
};
