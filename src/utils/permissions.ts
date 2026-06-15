import { GuildMember, PermissionFlagsBits, TextChannel } from "discord.js";
import { getOwner } from "../database";

export function isOwnerOrAdmin(member: GuildMember, channelId: string): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return getOwner(channelId) === member.id;
}

export async function setDefaultPermissions(channel: TextChannel) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    ViewChannel: true,
    SendMessages: true,
  });
}
