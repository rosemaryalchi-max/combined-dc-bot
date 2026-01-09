const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { claimDaily } = require('../../utils/stats');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward and build your streak!'),

    async execute(interaction) {
        const result = claimDaily(interaction.guildId, interaction.user.id);

        if (result.status === 'cooldown') {
            const hours = Math.floor(result.remaining / (1000 * 60 * 60));
            const minutes = Math.floor((result.remaining % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({
                content: `⏳ You have already claimed your daily reward!\nCome back in **${hours}h ${minutes}m**.`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🌞 Daily Reward Claimed!')
            .setDescription(`You kept your streak alive!\n\n🔥 **Current Streak:** ${result.streak} days`)
            .setColor('Orange')
            .setFooter({ text: 'Come back tomorrow to keep the streak!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
