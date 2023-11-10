import type { CommandInteraction, GuildMember, TextChannel, ThreadChannel } from "discord.js";
import { ApplicationCommandOptionType, ThreadAutoArchiveDuration } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { askAi } from "../../chatgpt/askAi.js";

@Discord()
export class Ai {
  @Slash({ name: "ai", description: "talk to ai" })
  async ai(
    @SlashOption({
      name: "text",
      description: "ask ai a question",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    text: string,
    interaction: CommandInteraction,
  ) {
    try {
      const channel = interaction.channel as TextChannel | ThreadChannel;

      if (channel.isThread()) {
        await interaction.deferReply();
        return await askAi({ channel, user: interaction.user, text });
      } else {
        await interaction.deferReply({ ephemeral: true });
        const thread = await this.createThread(channel as TextChannel, interaction.member as GuildMember, text);
        askAi({ channel: thread, user: interaction.user, text });
      }

      await interaction.editReply("Please continue the conversation in the thread below");
    } catch (error) {
      console.error(error);
      await interaction.editReply("An error occurred while processing your request.");
    }
  }

  private async createThread(channel: TextChannel, member: GuildMember, text: string): Promise<ThreadChannel> {
    const threadName = `${member.displayName}: ${text.substring(0, 50)}`;
    const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });

    await thread.members.add(member.id);
    return thread;
  }
}
