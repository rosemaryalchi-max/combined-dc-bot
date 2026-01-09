const { SlashCommandBuilder } = require('discord.js');
const music = require('../../modules/MusicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jump')
        .setDescription('Jump to a specific song in the queue.')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Queue position to jump to (1-indexed)')
                .setRequired(true)),
    async execute(interaction) {
        const pos = interaction.options.getInteger('position');
        // Convert to 0-index
        const success = music.jump(interaction.guildId, pos - 1);

        if (success) {
            await interaction.reply(`⏭️ Jumped to position **${pos}**.`);
        } else {
            await interaction.reply({ content: 'Invalid position!', ephemeral: true });
        }
    },
};
