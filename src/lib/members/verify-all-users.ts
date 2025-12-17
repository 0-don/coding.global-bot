import { error, log } from "console";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import type { TextBasedChannel } from "discord.js";
import { Collection, Guild, GuildMember, Role } from "discord.js";
import { prisma } from "../../prisma";
import { STATUS_ROLES, VERIFIED } from "../constants";
import { RolesService } from "../roles/roles.service";
import { updateCompleteMemberData } from "./member-data.service";

dayjs.extend(duration);

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

  private get guildDisplayName(): string {
    return this.guild.name.length > 30
      ? this.guild.name.slice(0, 30) + "..."
      : this.guild.name;
  }

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
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const members = await this.guild.members.fetch();
        if (attempt > 1) {
          log(`✅ Fetched ${members.size} members on attempt ${attempt}`);
        }
        return members;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        error(`Failed to fetch members (attempt ${attempt}/${maxRetries}):`, errorObj);
        lastError = errorObj;

        if (
          "name" in errorObj &&
          errorObj.name === "GatewayRateLimitError"
        ) {
          const retryAfter =
            "data" in errorObj &&
            typeof errorObj.data === "object" &&
            errorObj.data &&
            "retry_after" in errorObj.data
              ? (errorObj.data.retry_after as number)
              : 30;
          const waitTime = Math.ceil(retryAfter * 1000);

          error(`⚠️ Rate limited! Waiting ${retryAfter}s before retry...`);

          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        } else {
          throw errorObj;
        }
      }
    }

    throw lastError || new Error("Failed to fetch members");
  }

  private async processMember(
    member: GuildMember,
    guildStatusRoles: Record<string, Role | undefined>,
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
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const isRateLimit =
          ("name" in errorObj && errorObj.name === "GatewayRateLimitError") ||
          ("code" in errorObj && errorObj.code === 50001);

        if (isRateLimit) {
          const retryAfter =
            "data" in errorObj &&
            typeof errorObj.data === "object" &&
            errorObj.data &&
            "retry_after" in errorObj.data
              ? (errorObj.data.retry_after as number)
              : 5;
          const waitTime = Math.ceil(retryAfter * 1000);

          error(
            `⚠️ Rate limited on ${member.user.username}! Waiting ${retryAfter}s...`,
          );

          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          error(
            `Failed to process ${member.user.username} on attempt ${attempt}:`,
            errorObj,
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

    const startTime = state?.startTime || dayjs().valueOf();

    try {
      log(`🚀 Starting verification for ${this.guildDisplayName}`);

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
        error(`❌ ${this.guildDisplayName}: Missing roles:\n${content}`);
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
        `✅ ${this.guildDisplayName}: Processing ${totalMembers} members${resumeMessage}`,
      );
      await this.updateProgress(
        `Processing ${totalMembers} members${resumeMessage}...`,
        state,
      );

      for (let i = startIndex; i < totalMembers; i++) {
        const currentMember = nonBotMembers[i];

        await this.processMember(currentMember, guildStatusRoles);

        state.lastProcessedIndex = i + 1;
        this.setState(state);

        const progressPercent = Math.round(((i + 1) / totalMembers) * 100);
        const progressMessage = `Processed ${i + 1}/${totalMembers} members (${progressPercent}%)`;

        await this.updateProgress(progressMessage, state);
      }

      const durationMs = dayjs().valueOf() - startTime;
      const formattedDuration = dayjs.duration(durationMs).format("HH:mm:ss");
      log(`🎉 Completed verification for ${this.guildDisplayName}`);
      log(`⏱️ Total time: ${formattedDuration}`);

      await this.updateProgress(
        `✅ Completed verification! Processed ${totalMembers} members in ${formattedDuration}`,
        state,
      );

      MemberVerifier.states.delete(this.guild.id);
      return allMembers;
    } catch (err) {
      const durationMs = dayjs().valueOf() - startTime;
      const formattedDuration = dayjs.duration(durationMs).format("HH:mm:ss");
      error(
        `❌ Error in ${this.guildDisplayName} after ${formattedDuration}:`,
        err,
      );

      if (state) {
        state.isRunning = false;
        this.setState(state);

        await this.channel.send(
          `❌ Error occurred after ${formattedDuration}. Progress saved at ${state.lastProcessedIndex}/${state.totalMembers}. Run the command again to resume.`,
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
