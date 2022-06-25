import type { Client, Message, MessageEmbedOptions } from 'discord.js';
import type {
  RoleTemplateReaction,
  CreateRoleTemplateEmbed,
} from '../../types/types';

export const roleTemplateExampleEmbed: MessageEmbedOptions = {
  color: '#fd0000',
  title: 'Server Roles',
  description: 'Select your roles',
  fields: [],
  timestamp: new Date(),
  footer: {
    text: 'role template',
    icon_url:
      'https://raw.githubusercontent.com/Don-Cryptus/coding.global-web/main/public/favicon/favicon-96x96.png',
  },
};

export function createRoleTemplateEmbed(
  inputTemplate: RoleTemplateReaction,
  client: Client<boolean>
): CreateRoleTemplateEmbed {
  //validate input
  const error = validateRoleTemplate(inputTemplate, client);
  if (error) return { roleTemplateEmbed: undefined, emojis: undefined, error };

  // copy embed example
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

  // set embed title and description
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
}

export function parseRoleTemplateFromMsg(
  msg: Message<boolean>
): RoleTemplateReaction {
  // get embed from message
  const embed = msg.embeds[0];

  // parse emojis data from msg
  const emojis = msg.reactions.cache.map(
    // @ts-ignore
    (emoji) => ({ name: emoji._emoji.name, id: emoji._emoji.id })
  ) as { name: string; id: string }[];

  // recreate input role template json
  const roleTemplate = {
    title: embed?.title!,
    description: embed?.description!,
    reactions: embed?.fields
      // remove invisible whitespace
      .filter((reaction) => reaction.name !== '\u200b')
      .map((field, i) => {
        const emojiId = emojis[i]!.id;
        const emojiName = emojis[i]!.name;
        const emojiString = `<:${emojiName}:${emojiId}>`;
        return {
          name: field.name
            // remove invisible whitespace
            .replaceAll('\u2800', '')
            // remove emnoji
            .replaceAll(emojiString, '')
            .trim(),
          value: field.value,
          emoji: emojiName,
        };
      })!,
  } as RoleTemplateReaction;

  return roleTemplate;
}

export function validateRoleTemplate(
  inputTemplate: RoleTemplateReaction,
  client: Client<boolean>
) {
  let error = '';
  if (!inputTemplate) return 'No input provided.';
  if (!inputTemplate.title) return 'Title is required';
  if (!inputTemplate.description) return 'Description is required';

  inputTemplate.reactions.forEach((reaction, i) => {
    const emoji = client.emojis.cache.find(
      (emoji) => emoji.name === reaction?.emoji
    );
    if (!reaction?.name) error += `${i + 1}. Name is required\n`;
    if (!emoji)
      error += `${i + 1}. Emoji is required or didnt found: **${
        reaction?.emoji
      }**\n`;
  });

  return error;
}
