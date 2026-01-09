const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a specific position in the track.')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time to seek to (e.g. 1:30 or 90)')
                .setRequired(true)),
    async execute(interaction) {
        if (!music.validateChannel(interaction)) return interaction.reply({ content: '❌ Invalid channel!', ephemeral: true });

        const input = interaction.options.getString('time');
        let seconds = 0;

        if (input.includes(':')) {
            const parts = input.split(':').reverse();
            seconds += parseInt(parts[0]);
            if (parts[1]) seconds += parseInt(parts[1]) * 60;
            if (parts[2]) seconds += parseInt(parts[2]) * 3600;
        } else {
            seconds = parseInt(input);
        }

        if (isNaN(seconds)) return interaction.reply({ content: 'Invalid time format.', ephemeral: true });

        await interaction.deferReply();
        try {
            await music.seek(interaction.guildId, seconds);
            await interaction.editReply(`⏩ Seeked to **${seconds}s**.`);
        } catch (e) {
            await interaction.editReply(`❌ Error: ${e.message}`);
        }
    },
};
