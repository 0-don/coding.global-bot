import type { Message } from 'discord.js';
import { editRoleTemplateEmbed } from '../utils/roleTemplate';

export default {
  name: 'messageCreate',
  async execute(msg: Message<boolean>) {
    await editRoleTemplateEmbed(msg);
  },
};
