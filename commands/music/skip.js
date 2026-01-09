const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track'),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);

        if (!state.isPlaying) {
            return interaction.reply({ content: 'Nothing is playing!', ephemeral: true });
        }

        if (state.player) {
            state.player.stop();
            await interaction.reply('Skipped!');
        }
    },
};
