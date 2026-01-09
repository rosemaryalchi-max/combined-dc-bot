const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rewind')
        .setDescription('Rewind the current track.')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Seconds to rewind')
                .setRequired(true)),
    async execute(interaction) {
        const sec = interaction.options.getInteger('seconds');
        const current = music.getCurrentTime(interaction.guildId);
        let newTime = current - sec;
        if (newTime < 0) newTime = 0;

        await interaction.deferReply();
        try {
            await music.seek(interaction.guildId, newTime);
            await interaction.editReply(`⏪ Rewound by **${sec}s** (Now at ${newTime}s).`);
        } catch (e) {
            await interaction.editReply(`❌ Error: ${e.message}`);
        }
    },
};
