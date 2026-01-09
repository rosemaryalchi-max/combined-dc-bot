const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the playback volume')
        .addIntegerOption(option =>
            option.setName('percent')
                .setDescription('The volume percentage (0-100)')
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(true)),
    async execute(interaction) {
        const percent = interaction.options.getInteger('percent');
        const state = musicManager.getGuildState(interaction.guildId);

        if (!state.player) {
            return interaction.reply({ content: 'Nothing is playing!', ephemeral: true });
        }

        state.volume = percent / 100;
        if (state.player.state.resource && state.player.state.resource.volume) {
            state.player.state.resource.volume.setVolume(state.volume);
        }

        await interaction.reply(`Volume set to **${percent}%**`);
    },
};
