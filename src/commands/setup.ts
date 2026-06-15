import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { EMBED_COLOR } from "../config";
import { getSetupMessage, setSetupMessage } from "../database";
import { sendLog } from "../utils/logging";
import { CREATE_ARCHIVE_BUTTON_ID } from "../components/CreateArchiveButton";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Send the archive creation panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const oldSetup = getSetupMessage();
  if (oldSetup) {
    try {
      const oldChannel = interaction.guild.channels.cache.get(oldSetup.channel_id);
      if (oldChannel?.isTextBased()) {
        const oldMessage = await oldChannel.messages.fetch(oldSetup.message_id).catch(() => null);
        if (oldMessage) await oldMessage.delete().catch(() => null);
      }
    } catch {}
  }

  const embed = new EmbedBuilder()
    .setTitle("📁 Archive Management")
    .setDescription("Click the button below to create a new archive channel.")
    .setColor(EMBED_COLOR);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CREATE_ARCHIVE_BUTTON_ID)
      .setLabel("Create New Archive")
      .setEmoji("📁")
      .setStyle(ButtonStyle.Primary)
  );

  const message = await interaction.channel!.send({ embeds: [embed], components: [row] });
  setSetupMessage(message.id, interaction.channel!.id);

  await sendLog(interaction.guild, `⚙️ **Setup panel** deployed in ${interaction.channel} by ${interaction.user}`);
  await interaction.followUp("Setup panel sent!");
}
