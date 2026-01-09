const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('previous')
        .setDescription('Play the previous song.'),
    async execute(interaction) {
        const prev = music.previous(interaction.guildId);
        if (prev) {
            await interaction.reply(`⏮️ Playing previous song: **${prev.title}**`);
        } else {
            await interaction.reply({ content: 'No previous song in history!', ephemeral: true });
        }
    },
};
