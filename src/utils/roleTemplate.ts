import type { Client, MessageEmbedOptions } from 'discord.js';
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
    if (!emoji) error += `${i + 1}. Emoji is required or didnt found\n`;
  });

  return error;
}
