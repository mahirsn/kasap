import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { getOwner } from "../database";
import { isOwnerOrAdmin } from "../utils/permissions";
import { WARNING_COLOR, ERROR_COLOR } from "../config";
import { sendLog } from "../utils/logging";

export const TRANSFER_BUTTON_ID = "transfer_archive";
export const HIDE_BUTTON_ID = "hide_archive";
export const LOCK_BUTTON_ID = "lock_archive";
export const ADD_USER_BUTTON_ID = "add_user_archive";
export const REMOVE_USER_BUTTON_ID = "remove_user_archive";
export const DELETE_BUTTON_ID = "delete_archive";

export function buildArchiveActionRows(channelId: string): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TRANSFER_BUTTON_ID).setLabel("Transfer").setEmoji("🔁").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(HIDE_BUTTON_ID).setLabel("Hide").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(LOCK_BUTTON_ID).setLabel("Lock").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(ADD_USER_BUTTON_ID).setLabel("Add User").setEmoji("👤").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(REMOVE_USER_BUTTON_ID).setLabel("Remove User").setEmoji("❌").setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(DELETE_BUTTON_ID).setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
  );
  return [row1, row2];
}

async function checkOwner(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.guild) return false;
  if (isOwnerOrAdmin(interaction.member as GuildMember, interaction.channelId)) return true;
  await interaction.reply({ content: "Only the archive owner can use these buttons.", ephemeral: true });
  return false;
}

export async function handleTransfer(interaction: ButtonInteraction) {
  if (interaction.customId !== TRANSFER_BUTTON_ID) return;
  if (!(await checkOwner(interaction))) return;

  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId(`transfer_select_${interaction.channelId}`)
    .setPlaceholder("Select a user to transfer to")
    .setMinValues(1)
    .setMaxValues(1);

  await interaction.reply({
    content: "Select a user to transfer this archive to:",
    components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu)],
    ephemeral: true,
  });
}

export async function handleTransferSelect(interaction: any) {
  if (!interaction.customId.startsWith("transfer_select_")) return;
  if (!interaction.guild) return;

  const channelId = interaction.customId.replace("transfer_select_", "");
  const selectedUserId = interaction.values[0];
  const member = interaction.guild.members.cache.get(selectedUserId);

  if (!member) {
    await interaction.update({ content: "User not found.", components: [] });
    return;
  }

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`transfer_confirm_${channelId}_${selectedUserId}`)
      .setLabel(`Confirm transfer to ${member.user.username}`)
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.update({
    content: `Transfer archive to **${member.user.username}**?`,
    components: [confirmRow],
  });
}

export async function handleTransferConfirm(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith("transfer_confirm_")) return;
  if (!interaction.guild) return;

  const parts = interaction.customId.split("_");
  const channelId = parts[2];
  const newOwnerId = parts[3];

  const { transferArchive } = await import("../database");

  const channel = interaction.guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) {
    await interaction.update({ content: "Channel not found.", components: [] });
    return;
  }

  const oldOwnerId = getOwner(channelId);
  const newOwner = interaction.guild.members.cache.get(newOwnerId);
  const oldOwner = oldOwnerId ? interaction.guild.members.cache.get(oldOwnerId) : null;

  transferArchive(channelId, newOwnerId);

  await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    ViewChannel: null,
    SendMessages: null,
  });

  if (newOwner) {
    await channel.permissionOverwrites.edit(newOwner, {
      ViewChannel: true,
      SendMessages: true,
    });
  }

  if (oldOwner) {
    await channel.permissionOverwrites.delete(oldOwner).catch(() => null);
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔁 Archive Transferred")
        .setDescription(`This archive has been transferred to ${newOwner ?? "unknown"}.`)
        .setColor(WARNING_COLOR),
    ],
    components: buildArchiveActionRows(channelId),
  });

  await interaction.update({ content: `Archive transferred to **${newOwner?.user.username ?? "unknown"}**.`, components: [] });
  await sendLog(interaction.guild, `🔁 **Transferred** ${channel} from ${oldOwner ?? "unknown"} to ${newOwner ?? "unknown"}`);
}

export async function handleHide(interaction: ButtonInteraction) {
  if (interaction.customId !== HIDE_BUTTON_ID) return;
  if (!(await checkOwner(interaction))) return;

  const channel = interaction.channel as TextChannel;
  if (!channel) return;

  const everyone = interaction.guild!.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const isHidden = overwrite?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;

  if (isHidden) {
    await channel.permissionOverwrites.edit(everyone, { ViewChannel: null });
    await interaction.reply({ content: "Archive is now **visible**.", ephemeral: true });
    await sendLog(interaction.guild!, `👁️ **Unhidden** ${channel} by ${interaction.user}`);
  } else {
    await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
    await interaction.reply({ content: "Archive is now **hidden**.", ephemeral: true });
    await sendLog(interaction.guild!, `👁️ **Hidden** ${channel} by ${interaction.user}`);
  }
}

export async function handleLock(interaction: ButtonInteraction) {
  if (interaction.customId !== LOCK_BUTTON_ID) return;
  if (!(await checkOwner(interaction))) return;

  const channel = interaction.channel as TextChannel;
  if (!channel) return;

  const everyone = interaction.guild!.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const isLocked = overwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

  if (isLocked) {
    await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
    await interaction.reply({ content: "Archive is now **unlocked**.", ephemeral: true });
    await sendLog(interaction.guild!, `🔒 **Unlocked** ${channel} by ${interaction.user}`);
  } else {
    await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
    await interaction.reply({ content: "Archive is now **locked**.", ephemeral: true });
    await sendLog(interaction.guild!, `🔒 **Locked** ${channel} by ${interaction.user}`);
  }
}

export async function handleAddUser(interaction: ButtonInteraction) {
  if (interaction.customId !== ADD_USER_BUTTON_ID) return;
  if (!(await checkOwner(interaction))) return;

  const modal = new ModalBuilder()
    .setCustomId(`add_user_modal_${interaction.channelId}`)
    .setTitle("Add User to Archive");

  const input = new TextInputBuilder()
    .setCustomId("user_input")
    .setLabel("User mention or ID")
    .setPlaceholder("@user or 1234567890")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleRemoveUser(interaction: ButtonInteraction) {
  if (interaction.customId !== REMOVE_USER_BUTTON_ID) return;
  if (!(await checkOwner(interaction))) return;

  const modal = new ModalBuilder()
    .setCustomId(`remove_user_modal_${interaction.channelId}`)
    .setTitle("Remove User from Archive");

  const input = new TextInputBuilder()
    .setCustomId("user_input")
    .setLabel("User mention or ID")
    .setPlaceholder("@user or 1234567890")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleDelete(interaction: ButtonInteraction) {
  if (interaction.customId !== DELETE_BUTTON_ID) return;
  if (!(await checkOwner(interaction))) return;

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_confirm_${interaction.channelId}`)
      .setLabel("Yes, Delete")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("delete_cancel")
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: "Are you sure you want to delete this archive?",
    components: [confirmRow],
    ephemeral: true,
  });
}

export async function handleDeleteConfirm(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith("delete_confirm_")) return;
  if (!interaction.guild) return;

  const channelId = interaction.customId.replace("delete_confirm_", "");
  const { removeArchive } = await import("../database");

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel) {
    await interaction.update({ content: "Channel not found.", components: [] });
    return;
  }

  const channelName = channel.name;
  removeArchive(channelId);
  await sendLog(interaction.guild, `🗑️ **Deleted** \`#${channelName}\` by ${interaction.user}`);

  try {
    await interaction.update({ content: "Archive deleted.", components: [] });
  } catch {}

  await channel.delete().catch(() => null);
}

export async function handleDeleteCancel(interaction: ButtonInteraction) {
  if (interaction.customId !== "delete_cancel") return;
  await interaction.update({ content: "Deletion cancelled.", components: [] });
}
