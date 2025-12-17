import { error, log } from "console";
import type { TextBasedChannel } from "discord.js";
import { Collection, Guild, GuildMember } from "discord.js";
import { prisma } from "../../prisma";
import { STATUS_ROLES, VERIFIED } from "../constants";
import { RolesService } from "../roles/roles.service";
import { updateCompleteMemberData } from "./member-data.service";

interface VerificationState {
  lastProcessedIndex: number;
  totalMembers: number;
  startTime: number;
  isRunning: boolean;
  progressMessageId: string | null;
}

class MemberVerifier {
  private static states = new Map<string, VerificationState>();

  constructor(
    private guild: Guild,
    private channel: TextBasedChannel,
  ) {}

  static getState(guildId: string): VerificationState | undefined {
    return this.states.get(guildId);
  }

  static clearState(guildId: string): void {
    this.states.delete(guildId);
  }

  private get state(): VerificationState | undefined {
    return MemberVerifier.states.get(this.guild.id);
  }

  private setState(state: VerificationState): void {
    MemberVerifier.states.set(this.guild.id, state);
  }

  private async updateProgress(
    content: string,
    state: VerificationState,
  ): Promise<void> {
    if (!("send" in this.channel)) return;

    try {
      if (state.progressMessageId) {
        try {
          const msg = await this.channel.messages.fetch(
            state.progressMessageId,
          );
          await msg.edit(content);
        } catch {
          const newMsg = await this.channel.send(content);
          state.progressMessageId = newMsg.id;
        }
      } else {
        const newMsg = await this.channel.send(content);
        state.progressMessageId = newMsg.id;
      }
    } catch (err) {
      error("Failed to update progress:", err);
    }
  }

  private async fetchMembers(
    maxRetries = 3,
  ): Promise<Collection<string, GuildMember>> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(`📥 Fetching members (attempt ${attempt}/${maxRetries})...`);
        return await this.guild.members.fetch();
      } catch (err: any) {
        lastError = err;

        if (err.name === "GatewayRateLimitError") {
          const retryAfter = err.data?.retry_after || 30;
          const waitTime = Math.ceil(retryAfter * 1000);

          error(
            `⚠️ Rate limited! Waiting ${retryAfter}s before retry ${attempt}/${maxRetries}...`,
          );

          if (attempt < maxRetries)
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          throw err;
        }
      }
    }

    throw lastError;
  }

  private async processMember(
    member: GuildMember,
    guildStatusRoles: Record<string, any>,
  ): Promise<void> {
    let attempt = 0;

    while (true) {
      attempt++;
      try {
        await updateCompleteMemberData(member);

        if (guildStatusRoles[VERIFIED]) {
          const verifiedRoleId = guildStatusRoles[VERIFIED]!.id;
          if (!member.roles.cache.has(verifiedRoleId)) {
            const roleToAdd = member.guild.roles.cache.get(verifiedRoleId);
            if (roleToAdd?.editable) {
              await member.roles.add(verifiedRoleId);
            }
          }
        }

        return;
      } catch (err: any) {
        if (err.name === "GatewayRateLimitError" || err.code === 50001) {
          const retryAfter = err.data?.retry_after || 5;
          error(
            `⚠️ Rate limited on member ${member.user.username}! Waiting ${retryAfter}s (attempt ${attempt})...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.ceil(retryAfter * 1000)),
          );
        } else {
          error(
            `❌ Failed to process ${member.user.username} (${member.id}) on attempt ${attempt}:`,
            err,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  async run(): Promise<Collection<string, GuildMember> | undefined> {
    if (!("send" in this.channel)) {
      error("Channel does not support sending messages");
      return;
    }

    let state = this.state;
    if (state?.isRunning) {
      const message = `Verification already running. Progress: ${state.lastProcessedIndex}/${state.totalMembers}`;
      log(message);
      await this.channel.send(message);
      return;
    }

    const startTime = state?.startTime || Date.now();

    try {
      log(`🚀 Starting verification for ${this.guild.name} (${this.guild.id})`);

      await prisma.guild.upsert({
        where: { guildId: this.guild.id },
        create: { guildId: this.guild.id, guildName: this.guild.name },
        update: { guildName: this.guild.name },
      });

      const allMembers = await this.fetchMembers();
      const guildStatusRoles = RolesService.getGuildStatusRoles(this.guild);

      if (STATUS_ROLES.some((role) => !guildStatusRoles[role])) {
        const content = STATUS_ROLES.map(
          (role) => `${role}: ${!!guildStatusRoles[role]}`,
        ).join("\n");
        error(
          `❌ ${this.guild.name} (${this.guild.id}): Missing roles:\n${content}`,
        );
        await this.channel.send(`Missing required roles:\n${content}`);
        throw new Error("Missing required status roles");
      }

      const nonBotMembers = Array.from(allMembers.values()).filter(
        (m) => !m.user.bot,
      );
      const totalMembers = nonBotMembers.length;

      const startIndex = state?.lastProcessedIndex || 0;
      state = {
        lastProcessedIndex: startIndex,
        totalMembers,
        startTime,
        isRunning: true,
        progressMessageId: state?.progressMessageId || null,
      };
      this.setState(state);

      const resumeMessage =
        startIndex > 0 ? ` (resuming from ${startIndex}/${totalMembers})` : "";
      log(
        `✅ ${this.guild.name} (${this.guild.id}): Processing ${totalMembers} members${resumeMessage}`,
      );
      await this.updateProgress(
        `Processing ${totalMembers} members${resumeMessage}...`,
        state,
      );

      for (let i = startIndex; i < totalMembers; i++) {
        await this.processMember(nonBotMembers[i], guildStatusRoles);

        state.lastProcessedIndex = i + 1;
        this.setState(state);

        const progressPercent = Math.round(((i + 1) / totalMembers) * 100);
        const progressMessage = `Processed ${i + 1}/${totalMembers} members (${progressPercent}%)`;

        log(`✅ ${this.guild.name} (${this.guild.id}): ${progressMessage}`);
        await this.updateProgress(progressMessage, state);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      log(
        `🎉 Completed verification for ${this.guild.name} (${this.guild.id})`,
      );
      log(`⏱️ Total time: ${duration}s`);

      await this.updateProgress(
        `✅ Completed verification! Processed ${totalMembers} members in ${duration}s`,
        state,
      );

      MemberVerifier.states.delete(this.guild.id);
      return allMembers;
    } catch (err) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      error(
        `❌ Error in ${this.guild.name} (${this.guild.id}) after ${duration}s:`,
        err,
      );

      if (state) {
        state.isRunning = false;
        this.setState(state);

        await this.channel.send(
          `❌ Error occurred after ${duration}s. Progress saved at ${state.lastProcessedIndex}/${state.totalMembers}. Run the command again to resume.`,
        );
      }

      throw err;
    }
  }
}

export const verifyAllUsers = async (
  guild: Guild,
  channel: TextBasedChannel,
) => {
  const verifier = new MemberVerifier(guild, channel);
  return await verifier.run();
};

export const getVerificationState = (guildId: string) =>
  MemberVerifier.getState(guildId);
export const clearVerificationState = (guildId: string) =>
  MemberVerifier.clearState(guildId);
