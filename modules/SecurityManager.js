const { TextChannel } = require('discord.js');
const { sendLog } = require('../utils/logger');

async function lockdown(guild, enable, reason = 'Manual Lockdown') {
    const channels = guild.channels.cache.filter(c => c instanceof TextChannel);
    let updatedCount = 0;

    for (const [id, channel] of channels) {
        try {
            await channel.permissionOverwrites.edit(guild.id, {
                SendMessages: !enable
            });
            updatedCount++;
        } catch (e) {
            console.error(`Failed to lock channel ${channel.name}: ${e.message}`);
        }
    }

    const title = enable ? '🚨 SERVER LOCKED DOWN 🚨' : '✅ SERVER UNLOCKED';
    const description = enable
        ? `Lockdown initiated: ${reason}. Channels locked: ${updatedCount}.`
        : `Lockdown lifted: ${reason}. Channels unlocked.`;
    const color = enable ? 'DarkRed' : 'Green';

    await sendLog(guild.client, guild.id, title, description, color);
    return { title, description, updatedCount };
}

module.exports = { lockdown };
