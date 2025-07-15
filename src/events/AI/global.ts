import { bot } from "../../main.js";
 
export const getMemberCount = async (guildId: string): Promise<string> => {
  try {
    const guild = await bot.guilds.fetch(guildId);
    if (!guild) return "Server not found.";
    const memberCount = guild.memberCount;
    return `${memberCount}`;
  } catch (error) {
    console.error("Error fetching member count:", error);
    return "I couldn't fetch the member count. You can check it yourself at the top of the channels list.";
  }
};

 
 
