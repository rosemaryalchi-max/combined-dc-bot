const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removedups')
        .setDescription('Remove duplicate songs from the queue.'),
    async execute(interaction) {
        music.removeDupes(interaction.guildId);
        await interaction.reply('🧹 Removed duplicates from the queue.');
    },
};
