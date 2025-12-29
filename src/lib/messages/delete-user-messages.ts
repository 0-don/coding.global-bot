import {
  ChannelType,
  ForumChannel,
  Guild,
  NewsChannel,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { error } from "node:console";
import { prisma } from "../../prisma";
import { JAIL } from "../constants";
import { RolesService } from "../roles/roles.service";

type MessageChannel = TextChannel | NewsChannel | ThreadChannel;

export const deleteUserMessages = async (params: {
  guild: Guild;
  user: User | null;
  memberId: string;
  jail: string | number | boolean;
}) => {
  if (params.jail) {
    const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]?.id;
    if (!jailRoleId) return;

    await prisma.$transaction(async (tx) => {
      await tx.member.upsert({
        where: { memberId: params.memberId },
        create: {
          memberId: params.memberId,
          username: params.user?.username || "Unknown User",
        },
        update: {},
      });
      await tx.memberRole.deleteMany({
        where: { memberId: params.memberId, guildId: params.guild.id },
      });
      await tx.memberRole.create({
        data: {
          roleId: jailRoleId,
          memberId: params.memberId,
          guildId: params.guild.id,
          name: JAIL,
        },
      });
    });

    const member = params.guild.members.cache.get(
      params.user?.id || params.memberId,
    );
    const role = params.guild.roles.cache.get(jailRoleId);
    if (member && role?.editable)
      await member.roles.add(jailRoleId).catch(error);
  }

  const deleteMessages = async (channel: MessageChannel) => {
    const messages = await channel.messages.fetch({ limit: 100 });
    const userMessages = messages.filter(
      (m) => m.author.id === params.memberId,
    );
    if (userMessages.size > 0)
      await channel.bulkDelete(userMessages).catch(error);
  };

  const processThread = async (thread: ThreadChannel) => {
    if (thread.ownerId === params.memberId)
      return void (await thread.delete().catch(error));
    await deleteMessages(thread);
  };

  const promises: Promise<void>[] = [];
  for (const channel of params.guild.channels.cache.values()) {
    if (channel.type === ChannelType.GuildForum) {
      promises.push(
        (channel as ForumChannel).threads
          .fetchActive()
          .then(
            (t) =>
              Promise.all(t.threads.map(processThread)) as Promise<unknown>,
          )
          .catch(error) as Promise<void>,
      );
    } else if (
      [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
        channel.type,
      )
    ) {
      promises.push(
        deleteMessages(channel as MessageChannel).catch(error) as Promise<void>,
      );
    } else if (
      [ChannelType.PublicThread, ChannelType.PrivateThread].includes(
        channel.type,
      )
    ) {
      promises.push(
        processThread(channel as ThreadChannel).catch(error) as Promise<void>,
      );
    }
  }
  await Promise.all(promises);
};
