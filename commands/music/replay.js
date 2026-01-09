const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Replay the current song from the beginning.'),
    async execute(interaction) {
        await interaction.deferReply();
        try {
            await music.seek(interaction.guildId, 0);
            await interaction.editReply('🔄 Replaying current track.');
        } catch (e) {
            await interaction.editReply(`❌ Error: ${e.message}`);
        }
    },
};
