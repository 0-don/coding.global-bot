import type { APIEmbed, Client, Message } from 'discord.js';
import type {
  CreateRoleTemplateEmbed,
  RoleTemplateReaction,
} from '../../types/index.js';
import { roleTemplateExampleEmbed } from '../constants.js';

export async function createRoleTemplateEmbed(
  inputTemplate: RoleTemplateReaction,
  client: Client<boolean>
): Promise<CreateRoleTemplateEmbed> {
  //validate input
  const error = await validateRoleTemplate(inputTemplate, client);
  if (error) return { roleTemplateEmbed: undefined, emojis: undefined, error };

  // copy embed example
  const roleTemplateEmbed = JSON.parse(
    JSON.stringify(roleTemplateExampleEmbed)
  ) as APIEmbed;

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

export async function parseRoleTemplateFromMsg(
  msg: Message<boolean>
): Promise<RoleTemplateReaction> {
  // get embed from message
  const embed = msg.embeds[0];

  await msg.guild?.emojis.fetch();

  // parse emojis data from msg
  const emojis = msg.reactions.cache.map(
    // @ts-ignore
    (emoji) => ({ name: emoji._emoji.name, id: emoji._emoji.id })
  ) as { name: string; id: string }[];

  // recreate input role template json
  const roleTemplate = {
    title: embed?.title!,
    description: embed?.description,
    reactions: embed?.fields
      // remove invisible whitespace
      .filter((reaction) => reaction.name !== '\u200b')
      .map((field, i) => {
        const emojiId = emojis[i]?.id;
        const emojiName = emojis[i]?.name;
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
      }),
  } as RoleTemplateReaction;

  return roleTemplate;
}

export async function validateRoleTemplate(
  inputTemplate: RoleTemplateReaction,
  client: Client<boolean>
) {
  await client.guilds.fetch();
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
