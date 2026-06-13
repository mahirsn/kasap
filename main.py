import os
import sqlite3
import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Modal, TextInput, View, Button
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))

ARCHIVE_PANEL_CHANNEL_NAME = "create-archive"
LOG_CHANNEL_NAME = "archive-logs"
DB_FILE = "archives.db"

EMBED_COLOR = 0x2F3136
SUCCESS_COLOR = 0x57F287
ERROR_COLOR = 0xED4245
WARNING_COLOR = 0xFEE75C

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)


# ── Database ─────────────────────────────────────────────────────────────────


def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS archives (
            channel_id INTEGER PRIMARY KEY,
            owner_id INTEGER NOT NULL,
            guild_id INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def add_archive(channel_id: int, owner_id: int, guild_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute(
        "INSERT INTO archives (channel_id, owner_id, guild_id, created_at) VALUES (?, ?, ?, ?)",
        (channel_id, owner_id, guild_id, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


def remove_archive(channel_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM archives WHERE channel_id = ?", (channel_id,))
    conn.commit()
    conn.close()


def get_owner(channel_id: int) -> int | None:
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT owner_id FROM archives WHERE channel_id = ?", (channel_id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None


def transfer_archive(channel_id: int, new_owner_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE archives SET owner_id = ? WHERE channel_id = ?", (new_owner_id, channel_id))
    conn.commit()
    conn.close()


def get_user_archives(user_id: int, guild_id: int) -> list[tuple]:
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute(
        "SELECT channel_id FROM archives WHERE owner_id = ? AND guild_id = ?",
        (user_id, guild_id),
    )
    rows = c.fetchall()
    conn.close()
    return rows


# ── Helpers ──────────────────────────────────────────────────────────────────


async def send_log(guild: discord.Guild, message: str):
    log_channel = discord.utils.get(guild.text_channels, name=LOG_CHANNEL_NAME)
    if log_channel:
        embed = discord.Embed(description=message, color=EMBED_COLOR, timestamp=datetime.utcnow())
        await log_channel.send(embed=embed)


def is_owner_or_admin(interaction: discord.Interaction, channel_id: int) -> bool:
    if interaction.user.guild_permissions.administrator:
        return True
    owner = get_owner(channel_id)
    return owner == interaction.user.id


# ── Persistent Views ─────────────────────────────────────────────────────────


class CreateArchiveView(View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Create New Archive",
        emoji="📁",
        custom_id="create_archive_button",
        style=discord.ButtonStyle.primary,
    )
    async def create_archive(self, interaction: discord.Interaction, button: Button):
        modal = CreateArchiveModal()
        await interaction.response.send_modal(modal)


class ArchiveActionView(View):
    def __init__(self, channel_id: int):
        super().__init__(timeout=None)
        self.channel_id = channel_id

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if not is_owner_or_admin(interaction, self.channel_id):
            await interaction.response.send_message(
                "Only the archive owner can use these buttons.", ephemeral=True
            )
            return False
        return True

    @discord.ui.button(
        label="Transfer Archive",
        emoji="🔁",
        custom_id="transfer_archive_btn",
        style=discord.ButtonStyle.secondary,
    )
    async def transfer(self, interaction: discord.Interaction, button: Button):
        modal = TransferModal(channel_id=self.channel_id)
        await interaction.response.send_modal(modal)

    @discord.ui.button(
        label="Hide Archive",
        emoji="👁️",
        custom_id="hide_archive_btn",
        style=discord.ButtonStyle.secondary,
    )
    async def hide(self, interaction: discord.Interaction, button: Button):
        channel = interaction.guild.get_channel(self.channel_id)
        if not channel:
            await interaction.response.send_message("Channel not found.", ephemeral=True)
            return

        everyone = interaction.guild.default_role
        current_overwrite = channel.overwrites_for(everyone)
        is_hidden = current_overwrite.view_channel is False

        if is_hidden:
            current_overwrite.view_channel = None
            await channel.set_permissions(everyone, overwrite=current_overwrite)
            await interaction.response.send_message(
                "Archive is now **visible**.", ephemeral=True
            )
            await send_log(
                interaction.guild,
                f"👁️ **Unhidden** {channel.mention} by {interaction.user.mention}",
            )
        else:
            current_overwrite.view_channel = False
            await channel.set_permissions(everyone, overwrite=current_overwrite)
            await interaction.response.send_message(
                "Archive is now **hidden**.", ephemeral=True
            )
            await send_log(
                interaction.guild,
                f"👁️ **Hidden** {channel.mention} by {interaction.user.mention}",
            )

    @discord.ui.button(
        label="Lock Archive",
        emoji="🔒",
        custom_id="lock_archive_btn",
        style=discord.ButtonStyle.secondary,
    )
    async def lock(self, interaction: discord.Interaction, button: Button):
        channel = interaction.guild.get_channel(self.channel_id)
        if not channel:
            await interaction.response.send_message("Channel not found.", ephemeral=True)
            return

        everyone = interaction.guild.default_role
        current_overwrite = channel.overwrites_for(everyone)
        is_locked = current_overwrite.send_messages is False

        if is_locked:
            current_overwrite.send_messages = None
            await channel.set_permissions(everyone, overwrite=current_overwrite)
            await interaction.response.send_message(
                "Archive is now **unlocked**.", ephemeral=True
            )
            await send_log(
                interaction.guild,
                f"🔒 **Unlocked** {channel.mention} by {interaction.user.mention}",
            )
        else:
            current_overwrite.send_messages = False
            await channel.set_permissions(everyone, overwrite=current_overwrite)
            await interaction.response.send_message(
                "Archive is now **locked**.", ephemeral=True
            )
            await send_log(
                interaction.guild,
                f"🔒 **Locked** {channel.mention} by {interaction.user.mention}",
            )

    @discord.ui.button(
        label="Add User",
        emoji="👤",
        custom_id="add_user_archive_btn",
        style=discord.ButtonStyle.success,
    )
    async def add_user(self, interaction: discord.Interaction, button: Button):
        modal = AddUserModal(channel_id=self.channel_id)
        await interaction.response.send_modal(modal)

    @discord.ui.button(
        label="Remove User",
        emoji="❌",
        custom_id="remove_user_archive_btn",
        style=discord.ButtonStyle.danger,
    )
    async def remove_user(self, interaction: discord.Interaction, button: Button):
        modal = RemoveUserModal(channel_id=self.channel_id)
        await interaction.response.send_modal(modal)

    @discord.ui.button(
        label="Delete Archive",
        emoji="🗑️",
        custom_id="delete_archive_btn",
        style=discord.ButtonStyle.danger,
    )
    async def delete(self, interaction: discord.Interaction, button: Button):
        confirm_view = ConfirmDeleteView(channel_id=self.channel_id)
        await interaction.response.send_message(
            "Are you sure you want to delete this archive?",
            view=confirm_view,
            ephemeral=True,
        )


class ConfirmDeleteView(View):
    def __init__(self, channel_id: int):
        super().__init__(timeout=30)
        self.channel_id = channel_id

    @discord.ui.button(
        label="Yes, Delete",
        emoji="✅",
        custom_id="confirm_delete_btn",
        style=discord.ButtonStyle.danger,
    )
    async def confirm(self, interaction: discord.Interaction, button: Button):
        channel = interaction.guild.get_channel(self.channel_id)
        if not channel:
            await interaction.response.send_message("Channel not found.", ephemeral=True)
            return

        channel_name = channel.name
        remove_archive(self.channel_id)
        await send_log(
            interaction.guild,
            f"🗑️ **Deleted** `{channel_name}` by {interaction.user.mention}",
        )
        await channel.delete()
        try:
            await interaction.response.send_message("Archive deleted.", ephemeral=True)
        except discord.InteractionResponded:
            pass

    @discord.ui.button(
        label="Cancel",
        emoji="❌",
        custom_id="cancel_delete_btn",
        style=discord.ButtonStyle.secondary,
    )
    async def cancel(self, interaction: discord.Interaction, button: Button):
        await interaction.response.send_message("Deletion cancelled.", ephemeral=True)


# ── Modals ───────────────────────────────────────────────────────────────────


class CreateArchiveModal(Modal, title="Create New Archive"):
    name = TextInput(
        label="Archive Name",
        placeholder="e.g. project-notes",
        required=True,
        max_length=100,
    )
    description = TextInput(
        label="Description (optional)",
        placeholder="Brief description of this archive",
        required=False,
        max_length=100,
        style=discord.TextStyle.short,
    )

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        guild = interaction.guild
        user_display_name = interaction.user.display_name
        category = discord.utils.get(guild.categories, name=user_display_name)

        if not category:
            category = await guild.create_category(user_display_name)
            await send_log(
                guild,
                f"📂 **Category created** `{user_display_name}` by {interaction.user.mention}",
            )

        channel_name = self.name.value.lower().replace(" ", "-")
        existing = discord.utils.get(category.text_channels, name=channel_name)
        if existing:
            await interaction.followup.send(
                f"A channel named `{channel_name}` already exists in your archives.",
                ephemeral=True,
            )
            return

        topic = self.description.value if self.description.value else ""
        channel = await category.create_text_channel(channel_name, topic=topic)

        add_archive(channel.id, interaction.user.id, guild.id)

        everyone = guild.default_role
        await channel.set_permissions(everyone, view_channel=True, send_messages=True)

        embed = discord.Embed(
            title=f"📁 {self.name.value}",
            description=(
                f"Welcome to your new archive!\n\n**Description:** {topic}"
                if topic
                else "Welcome to your new archive!"
            ),
            color=SUCCESS_COLOR,
            timestamp=datetime.utcnow(),
        )
        embed.set_footer(text=f"Owned by {interaction.user.display_name}")

        view = ArchiveActionView(channel.id)
        await channel.send(embed=embed, view=view)

        await interaction.followup.send(
            f"Archive created: {channel.mention}", ephemeral=True
        )
        await send_log(
            guild,
            f"📁 **Archive created** {channel.mention} by {interaction.user.mention}",
        )


class TransferModal(Modal, title="Transfer Archive"):
    user_id = TextInput(
        label="User ID to transfer to",
        placeholder="Enter the user ID",
        required=True,
    )

    def __init__(self, channel_id: int):
        super().__init__()
        self.channel_id = channel_id

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        try:
            new_owner_id = int(self.user_id.value)
        except ValueError:
            await interaction.followup.send("Invalid user ID.", ephemeral=True)
            return

        new_owner = interaction.guild.get_member(new_owner_id)
        if not new_owner:
            await interaction.followup.send(
                "User not found in this server.", ephemeral=True
            )
            return

        channel = interaction.guild.get_channel(self.channel_id)
        if not channel:
            await interaction.followup.send("Channel not found.", ephemeral=True)
            return

        transfer_archive(self.channel_id, new_owner_id)

        everyone = interaction.guild.default_role
        await channel.set_permissions(everyone, overwrite=None)
        await channel.set_permissions(
            new_owner, view_channel=True, send_messages=True
        )
        await channel.set_permissions(interaction.user, overwrite=None)

        transfer_view = ArchiveActionView(self.channel_id)
        await channel.send(
            embed=discord.Embed(
                title="🔁 Archive Transferred",
                description=f"This archive has been transferred to {new_owner.mention}.",
                color=WARNING_COLOR,
            ),
            view=transfer_view,
        )

        await interaction.followup.send(
            f"Archive transferred to {new_owner.mention}.", ephemeral=True
        )
        await send_log(
            interaction.guild,
            f"🔁 **Transferred** {channel.mention} from {interaction.user.mention} to {new_owner.mention}",
        )


class AddUserModal(Modal, title="Add User to Archive"):
    user_id = TextInput(
        label="User ID to add", placeholder="Enter the user ID", required=True
    )

    def __init__(self, channel_id: int):
        super().__init__()
        self.channel_id = channel_id

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        try:
            target_id = int(self.user_id.value)
        except ValueError:
            await interaction.followup.send("Invalid user ID.", ephemeral=True)
            return

        target = interaction.guild.get_member(target_id)
        if not target:
            await interaction.followup.send(
                "User not found in this server.", ephemeral=True
            )
            return

        channel = interaction.guild.get_channel(self.channel_id)
        if not channel:
            await interaction.followup.send("Channel not found.", ephemeral=True)
            return

        await channel.set_permissions(target, view_channel=True, send_messages=True)
        await interaction.followup.send(
            f"{target.mention} has been added to this archive.", ephemeral=True
        )
        await send_log(
            interaction.guild,
            f"👤 **User added** {target.mention} to {channel.mention} by {interaction.user.mention}",
        )


class RemoveUserModal(Modal, title="Remove User from Archive"):
    user_id = TextInput(
        label="User ID to remove", placeholder="Enter the user ID", required=True
    )

    def __init__(self, channel_id: int):
        super().__init__()
        self.channel_id = channel_id

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        try:
            target_id = int(self.user_id.value)
        except ValueError:
            await interaction.followup.send("Invalid user ID.", ephemeral=True)
            return

        target = interaction.guild.get_member(target_id)
        if not target:
            await interaction.followup.send(
                "User not found in this server.", ephemeral=True
            )
            return

        channel = interaction.guild.get_channel(self.channel_id)
        if not channel:
            await interaction.followup.send("Channel not found.", ephemeral=True)
            return

        current_overwrite = channel.overwrites_for(target)
        if current_overwrite is None or (
            current_overwrite.view_channel is None
            and current_overwrite.send_messages is None
        ):
            await interaction.followup.send(
                "This user doesn't have explicit permissions in this archive.",
                ephemeral=True,
            )
            return

        await channel.set_permissions(target, overwrite=None)
        await interaction.followup.send(
            f"{target.mention} has been removed from this archive.", ephemeral=True
        )
        await send_log(
            interaction.guild,
            f"❌ **User removed** {target.mention} from {channel.mention} by {interaction.user.mention}",
        )


# ── Events & Commands ────────────────────────────────────────────────────────


@bot.event
async def on_ready():
    init_db()
    bot.add_view(CreateArchiveView())
    for guild in bot.guilds:
        for channel in guild.text_channels:
            owner = get_owner(channel.id)
            if owner:
                bot.add_view(ArchiveActionView(channel.id))

    await bot.tree.sync(guild=discord.Object(id=GUILD_ID))
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    print(f"Synced commands to guild {GUILD_ID}")


@bot.tree.command(
    name="arsivlerim",
    description="List all archives you own",
    guild=discord.Object(id=GUILD_ID),
)
async def arsivlerim(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)

    archives = get_user_archives(interaction.user.id, interaction.guild_id)
    if not archives:
        await interaction.followup.send(
            "You don't own any archives.", ephemeral=True
        )
        return

    embed = discord.Embed(
        title="📁 Your Archives",
        color=EMBED_COLOR,
        timestamp=datetime.utcnow(),
    )
    embed.set_footer(text=f"Requested by {interaction.user.display_name}")

    for (channel_id,) in archives:
        channel = interaction.guild.get_channel(channel_id)
        if channel:
            topic = channel.topic if channel.topic else "No description"
            embed.add_field(name=channel.mention, value=topic, inline=False)
        else:
            remove_archive(channel_id)

    await interaction.followup.send(embed=embed, ephemeral=True)


@bot.tree.command(
    name="setup-panel",
    description="Send the archive creation panel",
    guild=discord.Object(id=GUILD_ID),
)
@app_commands.checks.has_permissions(administrator=True)
async def setup_panel(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)

    channel = discord.utils.get(
        interaction.guild.text_channels, name=ARCHIVE_PANEL_CHANNEL_NAME
    )
    if not channel:
        await interaction.followup.send(
            f"Channel `#{ARCHIVE_PANEL_CHANNEL_NAME}` not found.", ephemeral=True
        )
        return

    embed = discord.Embed(
        title="📁 Archive Management",
        description="Click the button below to create a new archive.",
        color=EMBED_COLOR,
    )
    view = CreateArchiveView()
    await channel.send(embed=embed, view=view)
    await interaction.followup.send("Panel sent!", ephemeral=True)


def main():
    if not BOT_TOKEN:
        print("ERROR: BOT_TOKEN is not set in .env")
        return
    if not GUILD_ID:
        print("ERROR: GUILD_ID is not set in .env")
        return
    bot.run(BOT_TOKEN)


if __name__ == "__main__":
    main()
