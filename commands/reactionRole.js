const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reaction-role')
        .setDescription('Create a reaction role message')
        .addRoleOption(option => option.setName('role').setDescription('Role to give').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Message description').setRequired(true))
        .addStringOption(option => option.setName('emoji').setDescription('Emoji to react with').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const description = interaction.options.getString('description');
        const emoji = interaction.options.getString('emoji');

        const embed = new EmbedBuilder()
            .setTitle('Reaction Role')
            .setDescription(`${description}\n\nReact with ${emoji} to get the **${role.name}** role!`)
            .setColor(role.color || 'Blue');

        const message = await interaction.channel.send({ embeds: [embed] });
        try {
            await message.react(emoji);
            await interaction.reply({ content: 'Reaction role created!', ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: 'Failed to react with emoji. Make sure it is valid.', ephemeral: true });
        }
    },
};
