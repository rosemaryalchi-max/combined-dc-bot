const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Get lyrics for the current or specified song.')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('Song name (optional, defaults to current)')),
    async execute(interaction) {
        await interaction.deferReply();
        const query = interaction.options.getString('song');

        let searchTerm = query;
        if (!searchTerm) {
            const state = music.getGuildState(interaction.guildId);
            if (!state.current) return interaction.editReply('Nothing playing and no search term provided.');
            searchTerm = state.current.title;
        }

        // Without an external API key (Genius/Musixmatch), lyrics are hard.
        // We will mock this or provide a link to search.

        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm + ' lyrics')}`;

        const embed = new EmbedBuilder()
            .setTitle(`🎤 Lyrics for: ${searchTerm}`)
            .setDescription(`Due to copyright restrictions, I cannot display full lyrics directly.\n\n[👉 Click here to view lyrics on Google](${searchUrl})\n\n[👉 Click here for Genius](${`https://genius.com/search?q=${encodeURIComponent(searchTerm)}`})`)
            .setColor('Yellow');

        await interaction.editReply({ embeds: [embed] });
    },
};
