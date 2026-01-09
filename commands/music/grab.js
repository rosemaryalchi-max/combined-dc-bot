const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grab')
        .setDescription('Send the current song info to your DM.'),
    async execute(interaction) {
        const state = music.getGuildState(interaction.guildId);
        const track = state.current;

        if (!track) return interaction.reply({ content: 'Nothing is playing!', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('💾 Song Saved')
            .setDescription(`**Title:** [${track.title}](${track.url})`)
            .addFields(
                { name: 'Duration', value: `${track.duration}s`, inline: true },
                { name: 'Saved From', value: interaction.guild.name, inline: true }
            )
            .setColor('Green')
            .setThumbnail(track.thumbnail || null); // Assuming thumbnails exist or null

        try {
            await interaction.user.send({ embeds: [embed] });
            await interaction.reply({ content: '✅ Sent to your DMs!', ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: '❌ Could not DM you. Are your DMs open?', ephemeral: true });
        }
    },
};
