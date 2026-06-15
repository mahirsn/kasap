import {
  ButtonInteraction,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
} from "discord.js";

type ModalRow = ActionRowBuilder<ModalActionRowComponentBuilder>;

export const CREATE_ARCHIVE_BUTTON_ID = "create_archive_button";

export async function handle(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("create_archive_modal")
    .setTitle("Create New Archive");

  const nameInput = new TextInputBuilder()
    .setCustomId("archive_name")
    .setLabel("Archive Name")
    .setPlaceholder("e.g. project-notes")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const descInput = new TextInputBuilder()
    .setCustomId("archive_description")
    .setLabel("Description (optional)")
    .setPlaceholder("Brief description of this archive")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ModalRow().addComponents(nameInput),
    new ModalRow().addComponents(descInput)
  );

  await interaction.showModal(modal);
}
