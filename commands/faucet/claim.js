const { SlashCommandBuilder } = require('discord.js');
const faucetManager = require('../../modules/FaucetManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Claim crypto from faucet')
        .addStringOption(option =>
            option.setName('network')
                .setDescription('The network to claim on')
                .addChoices(
                    { name: 'Base USDT', value: 'base-usdt' },
                    { name: 'Sepolia ETH', value: 'sepolia-eth' }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName('address')
                .setDescription('Your wallet address')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const network = interaction.options.getString('network');
        const address = interaction.options.getString('address');

        try {
            const txHash = await giveawayManager.claim(network, address, interaction.user.id, interaction.guildId);
            await interaction.editReply(`✅ Claim successful! Tx: \`${txHash}\``);
        } catch (error) {
            await interaction.editReply(`❌ Claim failed: ${error.message}`);
        }
    },
};
