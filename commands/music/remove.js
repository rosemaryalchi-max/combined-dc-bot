const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
            option.setName('index')
                .setDescription('The index of the song to remove (1-based)')
                .setRequired(true)),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        const index = interaction.options.getInteger('index') - 1; // Convert 1-based to 0-based
        const removed = musicManager.removeFromQueue(interaction.guildId, index);

        if (removed) {
            await interaction.reply({ content: `Removed **${removed.title}** from the queue.`, ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Invalid queue index.', ephemeral: true });
        }
    },
};
