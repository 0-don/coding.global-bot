import { PrismaClient } from '@prisma/client';
import { InteractionType, Message } from 'discord.js';

const prisma = new PrismaClient();

export const bumpCount = async (message: Message<boolean>) => {
  // check if disboard bump command was used
  if (
    message.interaction?.type !== InteractionType.ApplicationCommand ||
    message.interaction?.commandName !== 'bump'
  )
    return;

  // get member info
  const memberId = message.interaction.user.id;
  const guildId = message.guild?.id;

  // if guild somehow doesnt exist return
  if (!guildId) return;

  // get member bump info from db
  let memberBump = await prisma.memberBump.findFirst({
    where: { memberId, guildId },
  });

  // if no member bump create one, else update it +1
  if (!memberBump) {
    memberBump = await prisma.memberBump.create({
      data: { memberId, guildId, count: 1 },
    });
  } else {
    memberBump = await prisma.memberBump.update({
      where: { member_guild: { memberId, guildId } },
      data: { count: memberBump.count + 1 },
    });
  }
  // const botChannel = message.guild.channels.cache.find(
  //   (channel) => channel.name === BOT_CHANNEL
  // ) as TextChannel;

  // // get bumper role
  // const bumperRole = message.guild.roles.cache.find(
  //   ({ name }) => name === BUMPER
  // );

  // if (memberBump.count >= 10) {
  //   const member = await message.guild.members.fetch(memberId);

  //   // if Bumper role on user then exit
  //   if (
  //     !member.roles.cache.some((role) => BUMPER.includes(role.name)) &&
  //     bumperRole
  //   ) {
  //     await member.roles.add(bumperRole);

  //     await botChannel.send(`Congrats <@${memberId}> you are now a bumper!`);
  //   }
  // } else if (memberBump.count <= 10) {
  //   await botChannel.send(
  //     ` <@${memberId}> You have bumped ${memberBump.count} times!, you need 10 bumps to get the Bumper role!`
  //   );
  // }

  // setTimeout(
  //   async () => await botChannel.send(`Bump time is up!`),
  //   1000 * 60 * 60 * 2
  // );
};
