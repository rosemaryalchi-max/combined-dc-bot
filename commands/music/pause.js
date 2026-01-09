const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause playback'),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);
        if (state.player) {
            state.player.pause();
            await interaction.reply('Paused playback.');
        } else {
            await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
        }
    },
};
