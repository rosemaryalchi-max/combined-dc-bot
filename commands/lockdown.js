const { SlashCommandBuilder, PermissionFlagsBits, TextChannel } = require('discord.js');
const { sendLog } = require('../utils/logger');

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
            const channels = guild.channels.cache.filter(c => c instanceof TextChannel);
            let updatedCount = 0;

            for (const [id, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.id, {
                        SendMessages: !state
                    });
                    updatedCount++;
                } catch (e) {
                    console.error(`Failed to lock channel ${channel.name}: ${e.message}`);
                }
            }

            const title = state ? '🚨 SERVER LOCKED DOWN 🚨' : '✅ SERVER UNLOCKED';
            const description = state
                ? `Emergency lockdown initiated by ${interaction.user}. Channels locked: ${updatedCount}.`
                : `Lockdown lifted by ${interaction.user}. Channels unlocked.`;
            const color = state ? 'DarkRed' : 'Green';

            await interaction.editReply({ content: description });
            await sendLog(interaction.client, guild.id, title, description, color);

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to execute lockdown.' });
        }
    },
};
