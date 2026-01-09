const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forward')
        .setDescription('Fast forward the current track.')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Seconds to move forward')
                .setRequired(true)),
    async execute(interaction) {
        const sec = interaction.options.getInteger('seconds');
        const current = music.getCurrentTime(interaction.guildId);
        const newTime = current + sec;

        await interaction.deferReply();
        try {
            await music.seek(interaction.guildId, newTime);
            await interaction.editReply(`⏩ Forwarded by **${sec}s** (Now at ${newTime}s).`);
        } catch (e) {
            await interaction.editReply(`❌ Error: ${e.message}`);
        }
    },
};
