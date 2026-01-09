const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Disconnect the bot from voice channel.'),
    async execute(interaction) {
        music.disconnect(interaction.guildId);
        await interaction.reply('👋 Disconnected.');
    },
};
