import type { MessageEmbedOptions } from 'discord.js';

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

export const statusRoles = [
  'verified',
  'voiceOnly',
  'readOnly',
  'mute',
  'unverified',
] as const;

export type StatusRoles = typeof statusRoles[number];
