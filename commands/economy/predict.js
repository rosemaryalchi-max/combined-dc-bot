const { SlashCommandBuilder } = require('discord.js');
const { addGuess } = require('../../modules/PredictionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('predict')
        .setDescription('Make a guess for the active prediction game.')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Your predicted price')
                .setRequired(true)),

    async execute(interaction) {
        const amount = interaction.options.getNumber('amount');
        const result = addGuess(interaction.channelId, interaction.user, amount);

        await interaction.reply({ content: result, ephemeral: true });
    },
};
