import type { MessageEmbedOptions } from 'discord.js';
import { statusRoles } from '../utils/constants';

export type RoleTemplateReactionValues = {
  name: string;
  value: string;
  emoji: string;
};
export type RoleTemplateReactionTuple = [
  RoleTemplateReactionValues,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?,
  RoleTemplateReactionValues?
];

export type RoleTemplateReaction = {
  title: string;
  description: string;
  reactions: RoleTemplateReactionTuple;
};

export type CreateRoleTemplateEmbed = {
  error: string | undefined;
  emojis: (string | undefined)[] | undefined;
  roleTemplateEmbed: MessageEmbedOptions | undefined;
};

export type QuestionRequest = {
  q: string;
  a: string[];
};

export type StatusRoles = typeof statusRoles[number];

export type ChartDataset = { x: Date; y: number };
