const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveawayManager = require('../../modules/GiveawayManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-reroll')
        .setDescription('Reroll a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)),
    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        const result = await giveawayManager.reroll(interaction, messageId);
        await interaction.reply({ content: result, ephemeral: true });
    },
};
