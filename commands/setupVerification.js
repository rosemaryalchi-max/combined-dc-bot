const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verification')
        .setDescription('Creates a verification message with a button.')
        .addRoleOption(option => option.setName('role').setDescription('The role to give when verified').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');

        const verifyButton = new ButtonBuilder()
            .setCustomId(`verify_btn_${role.id}`)
            .setLabel('Verify Me')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(verifyButton);

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('Server Verification')
            .setDescription('Click the button below to verify yourself and gain access to the server.');

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Verification message created!', ephemeral: true });
    },
};
