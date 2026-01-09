const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveawayManager = require('../../modules/GiveawayManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-end')
        .setDescription('Force end a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)),
    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        const g = giveawayManager.giveaways.find(x => x.messageId === messageId);

        if (!g) return interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
        if (g.ended) return interaction.reply({ content: 'Already ended.', ephemeral: true });

        await giveawayManager.finishGiveaway(g);
        await interaction.reply({ content: 'Giveaway ended.', ephemeral: true });
    },
};
