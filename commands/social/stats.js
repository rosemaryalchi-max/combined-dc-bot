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
                        { name: '🔥 Daily Streak', value: `${stats.daily?.streak || 0}`, inline: true },
                        { name: '🧠 Quiz Points', value: `${stats.quiz?.points || 0}`, inline: true },
                        { name: '📈 MEE6 Level', value: mee6Data ? `${mee6Data.level}` : 'N/A', inline: true }
                    );
            } else if (tab === 'messages') {
                embed.setTitle(`💬 Message Statistics`)
                    .setDescription(`**${targetUser.username}'s weekly activity**\n\nWeekly Count: **${stats.messages.count}**\n\n*Stats update in real-time as you chat.*`);
            } else if (tab === 'predictions') {
                embed.setTitle(`🎯 Prediction Game Stats`)
                    .setDescription(`**Prediction Performance**\n\n🏆 Total Wins: **${stats.predictions.wins}**\n\n*Participate in /guess games to increase your wins!*`);
            } else if (tab === 'streak') {
                embed.setTitle(`🔥 Daily Streak`)
                    .setDescription(`**Current Streak: ${stats.daily?.streak || 0} Days**\n\n*Use /daily every 24h to keep it going!*`);
            } else if (tab === 'quiz') {
                embed.setTitle(`🧠 Quiz Stats`)
                    .setDescription(`**Total Quiz Points: ${stats.quiz?.points || 0}**\n\n*Earn 10 points for every correct /quiz answer!*`);
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
                new ButtonBuilder().setCustomId('stats_streak').setLabel('Streak').setStyle(ButtonStyle.Secondary).setEmoji('🔥'),
                new ButtonBuilder().setCustomId('stats_quiz').setLabel('Quiz').setStyle(ButtonStyle.Secondary).setEmoji('🧠'),
                new ButtonBuilder().setCustomId('stats_mee6').setLabel('MEE6').setStyle(ButtonStyle.Secondary).setEmoji('📈'),
            );

        // Overflow row for less important ones if needed, or just swap
        // For now, removing 'Messages' and 'Predictions' from main row to fit Streak/Quiz or using 2 rows.
        // Let's use 2 rows to fit everything comfortably.

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('stats_messages').setLabel('Messages').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
                new ButtonBuilder().setCustomId('stats_predictions').setLabel('Predictions').setStyle(ButtonStyle.Secondary).setEmoji('🎯'),
            );

        const response = await interaction.editReply({ embeds: [generateEmbed('overview')], components: [row, row2] });

        // Collector
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'These buttons are not for you!', ephemeral: true });

            const tab = i.customId.replace('stats_', '');

            // Update button styles
            [row, row2].forEach(r => {
                r.components.forEach(btn => {
                    btn.setStyle(btn.data.custom_id === i.customId ? ButtonStyle.Primary : ButtonStyle.Secondary);
                });
            });

            await i.update({ embeds: [generateEmbed(tab)], components: [row, row2] });
        });

        collector.on('end', () => {
            [row, row2].forEach(r => r.components.forEach(btn => btn.setDisabled(true)));
            interaction.editReply({ components: [row, row2] }).catch(() => { });
        });
    },
};
