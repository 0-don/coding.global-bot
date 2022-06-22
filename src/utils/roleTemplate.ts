import { Client, Message, MessageEmbedOptions, Permissions } from 'discord.js';
import path from 'path';
import fs from 'fs';
import type {
  CreateRoleTemplateEmbed,
  RoleTemplateReaction,
} from '../types/types';

export const roleTemplateExampleEmbed: MessageEmbedOptions = {
  color: '#fd0000',
  title: 'Server Roles',
  description: 'Select your roles',
  fields: [],
  timestamp: new Date(),
  footer: {
    text: 'coding.global',
    icon_url:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  },
};

const roleTemplatePath = path.join(
  __dirname,
  '../roleTemplates',
  'programming-languages.json'
);

export const createRoleTemplateEmbed = (
  inputTemplate: RoleTemplateReaction,
  client: Client<boolean>
): CreateRoleTemplateEmbed => {
  const roleTemplateEmbed = JSON.parse(
    JSON.stringify(roleTemplateExampleEmbed)
  ) as MessageEmbedOptions;

  // parse emojis from template
  const emojis = inputTemplate.reactions.map((reaction) => {
    if (!reaction?.emoji) return;
    const serverEmoji = client.emojis.cache.find(
      (emoji) => emoji.name === reaction.emoji
    );
    return `<:${reaction.emoji}:${serverEmoji?.id}>`;
  });

  roleTemplateEmbed.title = inputTemplate.title;
  roleTemplateEmbed.description = inputTemplate.description;

  // push template values into embed fields
  inputTemplate.reactions.forEach((reaction, i) => {
    if (!reaction) return;
    roleTemplateEmbed.fields?.push({
      name: `${emojis[i]} ${reaction.name}\u2800\u2800\u2800\u2800\u2800`, // invisible whitespace
      value: reaction.value,
      inline: true,
    });
  });

  // push empty to make it look nice if uneven ammount
  if (inputTemplate.reactions.length % 3 === 2) {
    roleTemplateEmbed.fields?.push({
      name: '\u200b',
      value: '\u200b',
      inline: true,
    });
  }

  return {
    error: undefined,
    emojis,
    roleTemplateEmbed,
  };
};

export const editRoleTemplateEmbed = async (msg: Message<boolean>) => {
  if (
    msg.type === 'REPLY' &&
    msg.reference?.messageId &&
    msg.content.includes('/editRoleTemplate')
  ) {
    const user = await msg.guild?.members.fetch(msg.author.id);

    // check if user has permission to edit the message
    if (
      !user?.permissions.has([
        Permissions.FLAGS.KICK_MEMBERS,
        Permissions.FLAGS.BAN_MEMBERS,
      ])
    ) {
      return;
    }

    const json = msg.content
      .replace('/editRoleTemplate', '')
      .replaceAll('```', '')
      .trim();
    console.log(json);
    const inputTemplate = JSON.parse(json) as RoleTemplateReaction;

    // parse input template
    // const inputTemplate = JSON.parse(
    //   fs.readFileSync(roleTemplatePath, 'utf8')
    // ) as RoleTemplateReaction;

    // create embeded message or error
    const { roleTemplateEmbed } = createRoleTemplateEmbed(
      inputTemplate,
      msg.client
    );

    console.log(roleTemplateEmbed);

    if (!roleTemplateEmbed) {
      return;
    }

    // get reply message by id
    const replyMsg = await msg.channel.messages.fetch(msg.reference?.messageId);
    // edit embeded message
    await replyMsg.edit({ embeds: [roleTemplateEmbed] });

    await msg.delete();
  }
};
