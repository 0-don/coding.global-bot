import { error, log } from "console";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import type { TextBasedChannel } from "discord.js";
import { Collection, Guild, GuildMember } from "discord.js";
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
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const fetchStartTime = dayjs();
        const timestamp = fetchStartTime.format("HH:mm:ss");
        log(
          `[${timestamp}] 📥 Fetching members (attempt ${attempt}/${maxRetries})...`,
        );

        const members = await this.guild.members.fetch();

        const fetchDuration = dayjs()
          .diff(fetchStartTime, "second", true)
          .toFixed(2);
        log(
          `[${timestamp}] ✅ Fetched ${members.size} members in ${fetchDuration}s`,
        );

        return members;
      } catch (err: any) {
        const timestamp = dayjs().format("HH:mm:ss");
        error(
          `[${timestamp}] ❌ Failed to fetch members on attempt ${attempt}:`,
          err,
        );
        lastError = err;

        if (err.name === "GatewayRateLimitError") {
          const retryAfter = err.data?.retry_after || 30;
          const waitTime = Math.ceil(retryAfter * 1000);

          error(
            `[${timestamp}] ⚠️ Rate limited! Waiting ${retryAfter}s (${waitTime}ms) before retry ${attempt}/${maxRetries}...`,
          );

          if (attempt < maxRetries) {
            const waitStartTime = dayjs();
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            const actualWaitTime = dayjs()
              .diff(waitStartTime, "second", true)
              .toFixed(2);
            log(
              `[${dayjs().format("HH:mm:ss")}] ⏰ Waited ${actualWaitTime}s, retrying now...`,
            );
          }
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
    const memberStartTime = dayjs();

    while (true) {
      attempt++;
      try {
        const updateStartTime = dayjs();
        await updateCompleteMemberData(member);
        const updateDuration = dayjs()
          .diff(updateStartTime, "second", true)
          .toFixed(2);

        if (guildStatusRoles[VERIFIED]) {
          const verifiedRoleId = guildStatusRoles[VERIFIED]!.id;
          if (!member.roles.cache.has(verifiedRoleId)) {
            const roleToAdd = member.guild.roles.cache.get(verifiedRoleId);
            if (roleToAdd?.editable) {
              const roleStartTime = dayjs();
              await member.roles.add(verifiedRoleId);
              const roleDuration = dayjs()
                .diff(roleStartTime, "second", true)
                .toFixed(2);
              log(
                `  └─ Added verified role in ${roleDuration}s (update took ${updateDuration}s)`,
              );
            }
          }
        }

        const totalDuration = dayjs()
          .diff(memberStartTime, "second", true)
          .toFixed(2);
        if (parseFloat(totalDuration) > 2) {
          log(
            `  ⚠️ Slow processing: ${member.user.username} took ${totalDuration}s total`,
          );
        }

        return;
      } catch (err: any) {
        const timestamp = dayjs().format("HH:mm:ss");

        if (err.name === "GatewayRateLimitError" || err.code === 50001) {
          const retryAfter = err.data?.retry_after || 5;
          const waitTime = Math.ceil(retryAfter * 1000);

          error(
            `[${timestamp}] ⚠️ Rate limited on member ${member.user.username}! Waiting ${retryAfter}s (${waitTime}ms) - attempt ${attempt}`,
          );
          error(`  └─ Error details:`, {
            name: err.name,
            code: err.code,
            message: err.message,
          });

          const waitStartTime = dayjs();
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          const actualWaitTime = dayjs()
            .diff(waitStartTime, "second", true)
            .toFixed(2);
          log(
            `[${dayjs().format("HH:mm:ss")}] ⏰ Rate limit wait complete (${actualWaitTime}s), retrying ${member.user.username}...`,
          );
        } else {
          error(
            `[${timestamp}] ❌ Failed to process ${member.user.username} (${member.id}) on attempt ${attempt}:`,
          );
          error(`  └─ Error:`, err);
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
        const timestamp = dayjs().format("HH:mm:ss");

        log(
          `[${timestamp}] 🔄 ${this.guildDisplayName}: Processing ${i + 1}/${totalMembers} - ${currentMember.user.username}`,
        );

        await this.processMember(currentMember, guildStatusRoles);

        state.lastProcessedIndex = i + 1;
        this.setState(state);

        const progressPercent = Math.round(((i + 1) / totalMembers) * 100);
        const progressMessage = `Processed ${i + 1}/${totalMembers} members (${progressPercent}%)`;

        log(
          `[${timestamp}] ✅ ${this.guildDisplayName}: Completed ${currentMember.user.username} (${currentMember.id})`,
        );
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
