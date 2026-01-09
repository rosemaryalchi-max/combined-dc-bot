const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube or Spotify')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The URL or search term')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');
        const member = interaction.member;

        if (!musicManager.validateChannel(interaction)) {
            return interaction.reply({ content: '❌ Please use a **Voice Channel** chat or the configured music channel.', ephemeral: true });
        }

        if (!member.voice.channel) {
            return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            await musicManager.connect(member.voice.channel);
            const tracks = await musicManager.search(query);

            if (!tracks.length) {
                return interaction.editReply('No results found.');
            }

            const state = musicManager.getGuildState(interaction.guildId);
            const track = tracks[0];

            if (state.isPlaying) {
                state.queue.push(track);
                await interaction.editReply(`Added to queue: **${track.title}**`);
            } else {
                await musicManager.play(interaction.guildId, track);
                await interaction.editReply(`Now Playing: **${track.title}**`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while trying to play music.');
        }
    },
};
