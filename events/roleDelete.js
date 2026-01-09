const { Events, AuditLogEvent } = require('discord.js');
const { checkLimit, punishNuker } = require('../utils/antiNuke');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        const guild = role.guild;
        if (!guild) return;

        try {
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.RoleDelete,
            });
            const deletionLog = fetchedLogs.entries.first();

            if (!deletionLog) return;

            const { executor, target } = deletionLog;

            if (target.id === role.id) {
                // Check Limits: 3 roles in 10 seconds
                if (checkLimit(executor.id, 'roleDelete', 3, 10000)) {
                    await punishNuker(guild, executor.id, 'Mass Role Deletion');
                }
            }
        } catch (error) {
            console.error('Error in Anti-Nuke (Role):', error);
        }
    },
};
