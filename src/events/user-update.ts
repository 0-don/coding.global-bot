import { error } from "console";
import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { prisma } from "../prisma";

@Discord()
export class UserUpdate {
  @On()
  async userUpdate([oldUser, newUser]: ArgsOf<"userUpdate">) {
    try {
      // Force fetch to get banner and accent color data
      const fetchedUser = await newUser.fetch(true).catch(() => newUser);

      // Update user data in database
      await prisma.member.update({
        where: { memberId: newUser.id },
        data: {
          username: fetchedUser.username,
          globalName: fetchedUser.globalName,
          bannerUrl: fetchedUser.bannerURL({ size: 1024 }) || null,
          accentColor: fetchedUser.accentColor,
        },
      });
    } catch (err) {
      error(`Failed to update user ${newUser.id}:`, err);
    }
  }
}
