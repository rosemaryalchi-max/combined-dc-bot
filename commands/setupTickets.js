const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Creates a ticket panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const ticketButton = new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Open Ticket')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(ticketButton);

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('Support Tickets')
            .setDescription('Need help? Click the button below to open a private ticket.');

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Ticket panel created!', ephemeral: true });
    },
};
