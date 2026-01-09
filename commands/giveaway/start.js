const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveawayManager = require('../../modules/GiveawayManager');
const ms = require('ms'); // You might need to install ms or use a simple parser

function parseDuration(str) {
    const match = str.match(/(\d+)([dhms])/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 's') return val * 1000;
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-start')
        .setDescription('Start a timed giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 2d)').setRequired(true))
        .addStringOption(o => o.setName('prize').setDescription('The prize').setRequired(true))
        .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10)),
    async execute(interaction) {
        const durationStr = interaction.options.getString('duration');
        const prize = interaction.options.getString('prize');
        const winners = interaction.options.getInteger('winners') || 1;

        const duration = parseDuration(durationStr);
        if (!duration) {
            return interaction.reply({ content: 'Invalid duration format. Use 10s, 5m, 1h, etc.', ephemeral: true });
        }

        await giveawayManager.start(interaction, duration, prize, winners);
        await interaction.reply({ content: 'Giveaway started!', ephemeral: true });
    },
};
