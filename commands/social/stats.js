const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getStats } = require('../../utils/stats');
const { getUserRank } = require('../../utils/mee6');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Check your server activity and stats.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId;

        // Fetch Data
        const stats = getStats(guildId, targetUser.id);
        const mee6Data = await getUserRank(guildId, targetUser.id);

        // Helper to generate embeds
        const generateEmbed = (tab) => {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Statistics for ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor('Blurple')
                .setTimestamp();

            if (tab === 'overview') {
                embed.setDescription('**Quick Stats**')
                    .addFields(
                        { name: '💬 Messages (Week)', value: `${stats.messages.count}`, inline: true },
                        { name: '🎯 Prediction Wins', value: `${stats.predictions.wins}`, inline: true },
                        { name: '📈 MEE6 Level', value: mee6Data ? `${mee6Data.level}` : 'N/A', inline: true }
                    );
            } else if (tab === 'messages') {
                embed.setTitle(`💬 Message Statistics`)
                    .setDescription(`**${targetUser.username}'s weekly activity**\n\nWeekly Count: **${stats.messages.count}**\n\n*Stats update in real-time as you chat.*`);
            } else if (tab === 'predictions') {
                embed.setTitle(`🎯 Prediction Game Stats`)
                    .setDescription(`**Prediction Performance**\n\n🏆 Total Wins: **${stats.predictions.wins}**\n\n*Participate in /guess games to increase your wins!*`);
            } else if (tab === 'mee6') {
                embed.setTitle(`📈 MEE6 Integration`)
                    .setDescription('**Level & XP Data synced from MEE6**')
                    .addFields(
                        { name: 'Level', value: mee6Data ? `${mee6Data.level}` : 'No Data', inline: true },
                        { name: 'XP', value: mee6Data ? `${mee6Data.xp?.toLocaleString()}` : 'No Data', inline: true },
                        { name: 'Rank', value: mee6Data ? `#${mee6Data.rank}` : 'Unknown', inline: true }
                    );
            }

            return embed;
        };

        // Buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('stats_overview').setLabel('Overview').setStyle(ButtonStyle.Primary).setEmoji('🏠'),
                new ButtonBuilder().setCustomId('stats_messages').setLabel('Messages').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
                new ButtonBuilder().setCustomId('stats_predictions').setLabel('Predictions').setStyle(ButtonStyle.Secondary).setEmoji('🎯'),
                new ButtonBuilder().setCustomId('stats_mee6').setLabel('MEE6').setStyle(ButtonStyle.Secondary).setEmoji('📈'),
            );

        const response = await interaction.editReply({ embeds: [generateEmbed('overview')], components: [row] });

        // Collector
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'These buttons are not for you!', ephemeral: true });

            const tab = i.customId.replace('stats_', '');

            // Update button styles
            row.components.forEach(btn => {
                btn.setStyle(btn.data.custom_id === i.customId ? ButtonStyle.Primary : ButtonStyle.Secondary);
            });

            await i.update({ embeds: [generateEmbed(tab)], components: [row] });
        });

        collector.on('end', () => {
            row.components.forEach(btn => btn.setDisabled(true));
            interaction.editReply({ components: [row] }).catch(() => { });
        });
    },
};
