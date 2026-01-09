const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('Show now playing'),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);
        if (state.current) {
            const embed = new EmbedBuilder()
                .setTitle('Now Playing')
                .setDescription(`[${state.current.title}](${state.current.url})`)
                .setColor('Green');
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
        }
    },
};
