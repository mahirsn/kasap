import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "archives.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS archives (
    channel_id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS allowed_users (
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (channel_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS setup_message (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    message_id TEXT,
    channel_id TEXT
  );
`);

export function addArchive(channelId: string, ownerId: string, guildId: string) {
  db.prepare("INSERT INTO archives (channel_id, owner_id, guild_id, created_at) VALUES (?, ?, ?, ?)").run(
    channelId,
    ownerId,
    guildId,
    new Date().toISOString()
  );
}

export function removeArchive(channelId: string) {
  db.prepare("DELETE FROM archives WHERE channel_id = ?").run(channelId);
  db.prepare("DELETE FROM allowed_users WHERE channel_id = ?").run(channelId);
}

export function getOwner(channelId: string): string | null {
  const row = db.prepare("SELECT owner_id FROM archives WHERE channel_id = ?").get(channelId) as { owner_id: string } | undefined;
  return row?.owner_id ?? null;
}

export function transferArchive(channelId: string, newOwnerId: string) {
  db.prepare("UPDATE archives SET owner_id = ? WHERE channel_id = ?").run(newOwnerId, channelId);
  db.prepare("DELETE FROM allowed_users WHERE channel_id = ?").run(channelId);
}

export function getUserArchives(userId: string, guildId: string): { channel_id: string }[] {
  return db.prepare("SELECT channel_id FROM archives WHERE owner_id = ? AND guild_id = ?").all(userId, guildId) as { channel_id: string }[];
}

export function addAllowedUser(channelId: string, userId: string) {
  db.prepare("INSERT OR IGNORE INTO allowed_users (channel_id, user_id) VALUES (?, ?)").run(channelId, userId);
}

export function removeAllowedUser(channelId: string, userId: string) {
  db.prepare("DELETE FROM allowed_users WHERE channel_id = ? AND user_id = ?").run(channelId, userId);
}

export function getAllowedUsers(channelId: string): { user_id: string }[] {
  return db.prepare("SELECT user_id FROM allowed_users WHERE channel_id = ?").all(channelId) as { user_id: string }[];
}

export function setSetupMessage(messageId: string, channelId: string) {
  db.prepare("INSERT OR REPLACE INTO setup_message (id, message_id, channel_id) VALUES (1, ?, ?)").run(messageId, channelId);
}

export function getSetupMessage(): { message_id: string; channel_id: string } | null {
  return db.prepare("SELECT message_id, channel_id FROM setup_message WHERE id = 1").get() as { message_id: string; channel_id: string } | null | undefined ?? null;
}

export default db;
