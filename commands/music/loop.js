const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Toggle loop for the current song'),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);
        if (!state.player) {
            return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
        }

        const isLooping = musicManager.toggleLoop(interaction.guildId);
        await interaction.reply({ content: `Looping is now **${isLooping ? 'ON' : 'OFF'}**.`, ephemeral: true });
    },
};
