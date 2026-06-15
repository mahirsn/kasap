import { ModalSubmitInteraction, TextChannel, PermissionFlagsBits } from "discord.js";
import { sendLog } from "../utils/logging";

function parseUserId(input: string): string | null {
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  if (/^\d{17,20}$/.test(input.trim())) return input.trim();
  return null;
}

export async function handle(interaction: ModalSubmitInteraction) {
  if (!interaction.customId.startsWith("remove_user_modal_")) return;
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const channelId = interaction.customId.replace("remove_user_modal_", "");
  const input = interaction.fields.getTextInputValue("user_input");
  const userId = parseUserId(input);

  if (!userId) {
    await interaction.followUp("Invalid user mention or ID.");
    return;
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    await interaction.followUp("User not found in this server.");
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) {
    await interaction.followUp("Channel not found.");
    return;
  }

  const overwrite = channel.permissionOverrides.get(member.id);
  if (!overwrite) {
    await interaction.followUp("This user doesn't have explicit permissions in this archive.");
    return;
  }

  await channel.permissionOverwrites.delete(member);
  await interaction.followUp(`${member} has been removed from this archive.`);
  await sendLog(interaction.guild, `❌ **User removed** ${member} from ${channel} by ${interaction.user}`);
}
