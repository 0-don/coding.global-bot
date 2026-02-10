import { executeAuditRoles } from "@/core/handlers/command-handlers/admin/audit-roles.handler";
import { safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { memberCommandHistory } from "@/lib/db-schema";
import { MessageFlags, PermissionFlagsBits, type CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";

@Discord()
export class AuditRoles {
  @Slash({
    name: "audit-roles",
    description: "Audit all roles for elevated permissions",
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    dmPermission: false,
  })
  async auditRoles(interaction: CommandInteraction) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] }))) return;
    if (interaction.member?.user.id && interaction.guildId) {
      db.insert(memberCommandHistory)
        .values({
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "audit-roles",
        })
        .catch(() => {});
    }

    const result = await executeAuditRoles(interaction);

    await safeEditReply(interaction, result);
  }
}
