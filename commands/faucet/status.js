const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const faucetManager = require('../../modules/FaucetManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check the status of the faucet')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const state = faucetManager.loadState();
        const balances = await faucetManager.getBalances();

        const embed = new EmbedBuilder()
            .setTitle('💧 Faucet Status')
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '🔵 Base (USDT)',
                    value: `**Status**: ${state.base.paused ? '⏸️ Paused' : '✅ Active'}\n**Claims**: ${state.base.total}\n**Wallet ETH**: ${balances.baseEth}\n**Wallet USDT**: ${balances.baseUsdt}`,
                    inline: true
                },
                {
                    name: '⚪ Sepolia (ETH)',
                    value: `**Status**: ${state.sepolia.paused ? '⏸️ Paused' : '✅ Active'}\n**Claims**: ${state.sepolia.total}\n**Wallet ETH**: ${balances.sepoEth}`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
