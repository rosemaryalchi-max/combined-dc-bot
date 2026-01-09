const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { lockdown } = require('../modules/SecurityManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Locks down the server in case of emergency.')
        .addBooleanOption(option => option.setName('state').setDescription('True to lock, False to unlock').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const state = interaction.options.getBoolean('state');
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await lockdown(guild, state, `Manual action by ${interaction.user.tag}`);
            await interaction.editReply({ content: result.description });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to execute lockdown.' });
        }
    },
};
