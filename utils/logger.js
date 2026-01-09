const { EmbedBuilder } = require('discord.js');

/**
 * Logs an action to a specified channel.
 * @param {Client} client - The Discord client.
 * @param {string} title - Title of the log.
 * @param {string} description - Description of the log.
 * @param {string} color - Color of the embed (hex code or string).
 * @param {string} guildId - The ID of the guild where the log should be sent.
 */
async function sendLog(client, guildId, title, description, color = 'Blue') {
    // In a real app, you'd fetch logging channel ID from a database.
    // For now, we'll try to find a channel named 'mod-logs' or 'security-logs'.
    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) return;

        const channel = guild.channels.cache.find(c => c.name === 'mod-logs' || c.name === 'security-logs');

        if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Failed to send log:', error);
    }
}

module.exports = { sendLog };
