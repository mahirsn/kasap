import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ModalSubmitInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { BOT_TOKEN, GUILD_ID, EMBED_COLOR } from "./config";
import * as setupCommand from "./commands/setup";
import * as arsivlerimCommand from "./commands/arsivlerim";
import * as createArchiveButton from "./components/CreateArchiveButton";
import * as createArchiveModal from "./components/CreateArchiveModal";
import * as archiveActions from "./components/ArchiveActionButtons";
import * as addUserModal from "./components/AddUserModal";
import * as removeUserModal from "./components/RemoveUserModal";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);

  await guild.commands.set([setupCommand.data.toJSON(), arsivlerimCommand.data.toJSON()]);
  console.log(`Synced commands to ${guild.name}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        await setupCommand.execute(interaction);
      } else if (interaction.commandName === "arsivlerim") {
        await arsivlerimCommand.execute(interaction);
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === createArchiveButton.CREATE_ARCHIVE_BUTTON_ID) {
        await createArchiveButton.handle(interaction);
      } else if (id === archiveActions.TRANSFER_BUTTON_ID) {
        await archiveActions.handleTransfer(interaction);
      } else if (id === archiveActions.HIDE_BUTTON_ID) {
        await archiveActions.handleHide(interaction);
      } else if (id === archiveActions.LOCK_BUTTON_ID) {
        await archiveActions.handleLock(interaction);
      } else if (id === archiveActions.ADD_USER_BUTTON_ID) {
        await archiveActions.handleAddUser(interaction);
      } else if (id === archiveActions.REMOVE_USER_BUTTON_ID) {
        await archiveActions.handleRemoveUser(interaction);
      } else if (id === archiveActions.DELETE_BUTTON_ID) {
        await archiveActions.handleDelete(interaction);
      } else if (id.startsWith("delete_confirm_")) {
        await archiveActions.handleDeleteConfirm(interaction);
      } else if (id === "delete_cancel") {
        await archiveActions.handleDeleteCancel(interaction);
      } else if (id.startsWith("transfer_confirm_")) {
        await archiveActions.handleTransferConfirm(interaction);
      }
    }

    if (interaction.isUserSelectMenu() && interaction.customId.startsWith("transfer_select_")) {
      await archiveActions.handleTransferSelect(interaction);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "create_archive_modal") {
        await createArchiveModal.handle(interaction);
      } else if (interaction.customId.startsWith("add_user_modal_")) {
        await addUserModal.handle(interaction);
      } else if (interaction.customId.startsWith("remove_user_modal_")) {
        await removeUserModal.handle(interaction);
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);
    const reply = { content: "An error occurred.", ephemeral: true };
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.login(BOT_TOKEN);
