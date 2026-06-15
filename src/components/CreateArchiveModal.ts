import {
  ModalSubmitInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from "discord.js";
import { SUCCESS_COLOR } from "../config";
import { addArchive } from "../database";
import { sendLog } from "../utils/logging";
import { buildArchiveActionRow } from "./ArchiveActionButtons";

export async function handle(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "create_archive_modal") return;

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) return;

  const name = interaction.fields.getTextInputValue("archive_name");
  const description = interaction.fields.getTextInputValue("archive_description") || "";

  const displayName = interaction.user.displayName;
  let category = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildCategory && ch.name === displayName
  );

  if (!category) {
    category = await guild.channels.create({
      name: displayName,
      type: ChannelType.GuildCategory,
    });
    await sendLog(guild, `📂 **Category created** \`${displayName}\` by ${interaction.user}`);
  }

  const channelName = name.toLowerCase().replace(/\s+/g, "-");
  const existing = guild.channels.cache.find(
    (ch) => ch.parentId === category!.id && ch.name === channelName
  );
  if (existing) {
    await interaction.followUp(`A channel named \`#${channelName}\` already exists in your archives.`);
    return;
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: description || undefined,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ],
  });

  addArchive(channel.id, interaction.user.id, guild.id);

  const embed = new EmbedBuilder()
    .setTitle(`📁 ${name}`)
    .setDescription(description ? `Welcome to your new archive!\n\n**Description:** ${description}` : "Welcome to your new archive!")
    .setColor(SUCCESS_COLOR)
    .setTimestamp()
    .setFooter({ text: `Owned by ${displayName}` });

  await channel.send({ embeds: [embed], components: [buildArchiveActionRow(channel.id)] });

  await interaction.followUp(`Archive created: ${channel}`);
  await sendLog(guild, `📁 **Archive created** ${channel} by ${interaction.user}`);
}
