import { Guild, TextChannel } from "discord.js";
import { LOG_CHANNEL_NAME, EMBED_COLOR } from "../config";

export async function sendLog(guild: Guild, message: string) {
  const logChannel = guild.channels.cache.find(
    (ch) => ch.name === LOG_CHANNEL_NAME && ch.isTextBased()
  ) as TextChannel | undefined;

  if (logChannel) {
    await logChannel.send({
      embeds: [
        {
          description: message,
          color: EMBED_COLOR,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }
}
