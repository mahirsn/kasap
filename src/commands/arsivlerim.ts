import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { EMBED_COLOR } from "../config";
import { getUserArchives, removeArchive } from "../database";

export const data = new SlashCommandBuilder()
  .setName("arsivlerim")
  .setDescription("List all archives you own");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const archives = getUserArchives(interaction.user.id, interaction.guild.id);

  if (archives.length === 0) {
    await interaction.followUp("You don't own any archives.");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("📁 Your Archives")
    .setColor(EMBED_COLOR)
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.username}` });

  for (const { channel_id } of archives) {
    const channel = interaction.guild.channels.cache.get(channel_id);
    if (channel && channel.isTextBased()) {
      const topic = (channel as { topic?: string }).topic || "No description";
      embed.addFields({ name: `${channel}`, value: topic, inline: false });
    } else {
      removeArchive(channel_id);
    }
  }

  await interaction.followUp({ embeds: [embed] });
}
