const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPrice } = require('../../utils/crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('price')
        .setDescription('Check the price of a cryptocurrency.')
        .addStringOption(option =>
            option.setName('coin')
                .setDescription('The coin symbol (e.g. BTC, ETH)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const coin = interaction.options.getString('coin');

        try {
            const { price, name, symbol, image } = await getPrice(coin);

            const embed = new EmbedBuilder()
                .setTitle(`💰 ${name} (${symbol}) Price`)
                .setDescription(`The current price of **${name}** is **$${price.toLocaleString()}**`)
                .setThumbnail(image)
                .setColor('Gold')
                .setTimestamp()
                .setFooter({ text: 'Data via CoinGecko' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
};
