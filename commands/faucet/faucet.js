const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const faucetManager = require('../../modules/FaucetManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faucet')
        .setDescription('Manage crypto faucet')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('pause')
                .setDescription('Pause claims')
                .addStringOption(o => o.setName('network').setDescription('Network').setRequired(true)
                    .addChoices({ name: 'All', value: 'all' }, { name: 'Base', value: 'base-usdt' }, { name: 'Sepolia', value: 'sepolia-eth' }))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('resume')
                .setDescription('Resume claims')
                .addStringOption(o => o.setName('network').setDescription('Network').setRequired(true)
                    .addChoices({ name: 'All', value: 'all' }, { name: 'Base', value: 'base-usdt' }, { name: 'Sepolia', value: 'sepolia-eth' }))
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const network = interaction.options.getString('network');

        if (sub === 'pause') {
            await faucetManager.setPaused(network, true);
            await interaction.reply({ content: `Paused faucet for ${network}.`, ephemeral: true });
        } else if (sub === 'resume') {
            await faucetManager.setPaused(network, false);
            await interaction.reply({ content: `Resumed faucet for ${network}.`, ephemeral: true });
        }
    },
};
