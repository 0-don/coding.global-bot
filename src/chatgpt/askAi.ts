import { TextChannel, ThreadChannel, User } from "discord.js";
import { prisma } from "../prisma.js";

interface AskAi {
  channel: TextChannel | ThreadChannel;
  user: User;
  text: string;
}

export const askAi = async (props: AskAi) => {
  const memberGuild = await prisma.memberGuild.findFirst({
    where: { memberId: props.user.id },
  });

  if (!memberGuild) return null;
  
};
