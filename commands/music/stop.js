const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue'),
    async execute(interaction) {
        if (interaction.channel.name !== 'music') {
            return interaction.reply({ content: '❌ Please use the `#music` channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);

        state.queue = [];
        state.isPlaying = false;
        state.current = null;

        if (state.player) state.player.stop();
        if (state.connection) {
            state.connection.destroy();
            state.connection = null;
        }

        await interaction.reply({ content: 'Stopped playback and cleared queue.', ephemeral: true });
    },
};
