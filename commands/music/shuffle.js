const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the current queue'),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);
        if (state.queue.length < 2) {
            return interaction.reply({ content: 'Not enough songs in queue to shuffle.', ephemeral: true });
        }

        musicManager.shuffleQueue(interaction.guildId);
        await interaction.reply({ content: '🔀 Queue shuffled.', ephemeral: true });
    },
};
