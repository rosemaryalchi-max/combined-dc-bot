const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const backupManager = require('../modules/BackupManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manage server backups')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('create').setDescription('Create a new backup'))
        .addSubcommand(sub => sub.setName('list').setDescription('List available backups')),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const id = await backupManager.createBackup(interaction.guild);
                await interaction.editReply(`✅ Backup created successfully: \`${id}\``);
            } catch (e) {
                console.error(e);
                await interaction.editReply('❌ Failed to create backup.');
            }
        }
        else if (sub === 'list') {
            await interaction.deferReply({ ephemeral: true });
            const backups = backupManager.listBackups(interaction.guild.id);

            const embed = new EmbedBuilder()
                .setTitle('Server Backups')
                .setColor('Blue')
                .setDescription(backups.length ? backups.slice(0, 10).map((b, i) => `${i + 1}. <t:${Math.floor(b.timestamp / 1000)}:f> (\`${b.id}\`)`).join('\n') : 'No backups found.');

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
