const { Events, AuditLogEvent } = require('discord.js');
const { checkLimit, punishNuker } = require('../utils/antiNuke');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        const guild = channel.guild;
        if (!guild) return;

        // Fetch audit logs to find who deleted the channel
        try {
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.ChannelDelete,
            });
            const deletionLog = fetchedLogs.entries.first();

            if (!deletionLog) return; // No log found

            const { executor, target } = deletionLog;

            // Check if the log is relevant to this specific channel deletion
            // Note: Audit logs aren't always instant, but for mass deletion they usually match
            if (target.id === channel.id) {
                // Check Limits: 3 channels in 10 seconds
                if (checkLimit(executor.id, 'channelDelete', 3, 10000)) {
                    await punishNuker(guild, executor.id, 'Mass Channel Deletion');
                }
            }
        } catch (error) {
            console.error('Error in Anti-Nuke (Channel):', error);
        }
    },
};
