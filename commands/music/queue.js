const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current queue'),
    async execute(interaction) {
        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Invalid channel! Use Text-in-Voice or the configured music channel.', ephemeral: true });
        }

        const state = musicManager.getGuildState(interaction.guildId);

        const current = state.current ? `**Now Playing:** [${state.current.title}](${state.current.url})` : 'Nothing playing.';
        const queueStr = state.queue.length
            ? state.queue.map((t, i) => `${i + 1}. [${t.title}](${t.url})`).join('\n').slice(0, 4000)
            : 'Queue is empty.';

        const embed = new EmbedBuilder()
            .setTitle('Generic Bot Music Queue')
            .setDescription(`${current}\n\n**Queue:**\n${queueStr}`)
            .setColor('Blurple');

        await interaction.reply({ embeds: [embed] });
    },
};
