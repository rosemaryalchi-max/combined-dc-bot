const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Moderation commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kick a user')
                .addUserOption(option => option.setName('target').setDescription('The user to kick').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Reason for kick')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Ban a user')
                .addUserOption(option => option.setName('target').setDescription('The user to ban').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Reason for ban')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('timeout')
                .setDescription('Timeout a user')
                .addUserOption(option => option.setName('target').setDescription('The user to timeout').setRequired(true))
                .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Reason for timeout')))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers | PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const user = interaction.user;

        if (!target) {
            return interaction.reply({ content: 'Target member not found.', ephemeral: true });
        }

        // Prevent modding self or higher roles
        if (target.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot moderate yourself.', ephemeral: true });
        }
        if (!target.moderatable) {
            return interaction.reply({ content: 'I cannot moderate this user (they may have a higher role than me).', ephemeral: true });
        }

        try {
            if (subcommand === 'kick') {
                await target.kick(reason);
                await interaction.reply({ content: `Authored kick on ${target.user.tag} for: ${reason}`, ephemeral: true });
                await sendLog(interaction.client, interaction.guildId, 'User Kicked', `**Target:** ${target.user.tag}\n**Reason:** ${reason}\n**Moderator:** ${user.tag}`, 'Orange');
            } else if (subcommand === 'ban') {
                await target.ban({ reason: reason });
                await interaction.reply({ content: `Authored ban on ${target.user.tag} for: ${reason}`, ephemeral: true });
                await sendLog(interaction.client, interaction.guildId, 'User Banned', `**Target:** ${target.user.tag}\n**Reason:** ${reason}\n**Moderator:** ${user.tag}`, 'Red');
            } else if (subcommand === 'timeout') {
                const duration = interaction.options.getInteger('duration');
                await target.timeout(duration * 60 * 1000, reason);
                await interaction.reply({ content: `Timed out ${target.user.tag} for ${duration} minutes. Reason: ${reason}`, ephemeral: true });
                await sendLog(interaction.client, interaction.guildId, 'User Timed Out', `**Target:** ${target.user.tag}\n**Duration:** ${duration}m\n**Reason:** ${reason}\n**Moderator:** ${user.tag}`, 'Yellow');
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
        }
    },
};
