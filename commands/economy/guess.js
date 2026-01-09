const { SlashCommandBuilder } = require('discord.js');
const { startGame } = require('../../modules/PredictionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guess')
        .setDescription('Start a price prediction game.')
        .addStringOption(option =>
            option.setName('coin')
                .setDescription('The coin symbol (e.g. BTC)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('time')
                .setDescription('Duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(60)),

    async execute(interaction) {
        await interaction.deferReply();
        const coin = interaction.options.getString('coin').toUpperCase();
        const time = interaction.options.getInteger('time');

        await startGame(interaction, coin, time);
    },
};
