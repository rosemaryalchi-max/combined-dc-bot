const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your voice channel.'),
    async execute(interaction) {
        if (!music.validateChannel(interaction)) return interaction.reply({ content: '❌ Invalid channel!', ephemeral: true });

        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });

        try {
            await music.connect(channel);
            await interaction.reply(`🔊 Joined **${channel.name}**!`);
        } catch (e) {
            await interaction.reply(`❌ Failed to join: ${e.message}`);
        }
    },
};
