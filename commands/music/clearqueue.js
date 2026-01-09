const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Clear all songs in the queue.'),
    async execute(interaction) {
        music.clearQueue(interaction.guildId);
        await interaction.reply('🗑️ Queue cleared.');
    },
};
