import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { RolesModule } from "../modules/roles/Roles.module.js";

@Discord()
export class MessageReactionAdd {
  @On()
  async messageReactionAdd(
    [reaction, user]: ArgsOf<"messageReactionAdd">,
    client: Client,
  ) {
    // fetch reaction status and roles
    await reaction.fetch();

    // add verify role on like reaction in verify template
    await RolesModule.verifyReaction(reaction, user);

    return;
  }
}
