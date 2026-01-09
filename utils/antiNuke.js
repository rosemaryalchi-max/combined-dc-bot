const { sendLog } = require('./logger');

const limits = new Map();

/**
 * Checks if an action breaches the anti-nuke limit.
 * @param {string} executorId - The ID of the user performing the action.
 * @param {string} actionType - 'channelDelete', 'roleDelete', etc.
 * @param {number} limit - Max allowed actions.
 * @param {number} timeWindow - Time window in ms.
 * @returns {boolean} - True if limit breached.
 */
function checkLimit(executorId, actionType, limit = 3, timeWindow = 10000) {
    const key = `${executorId}-${actionType}`;
    const now = Date.now();

    if (!limits.has(key)) {
        limits.set(key, []);
    }

    const userLog = limits.get(key);
    userLog.push(now);

    // Filter old entries
    const recent = userLog.filter(timestamp => now - timestamp < timeWindow);
    limits.set(key, recent);

    return recent.length >= limit;
}

/**
 * Punishes a user for nuking.
 * @param {GuildMember} member - The member to punish.
 * @param {string} reason - Reason for punishment.
 */
async function punishNuker(guild, executorId, reason) {
    try {
        const member = await guild.members.fetch(executorId);
        if (member && member.bannable) {
            await member.ban({ reason: `ANTI-NUKE: ${reason}` });
            await sendLog(guild.client, guild.id, '🚨 ANTI-NUKE TRIGGERED 🚨', `**BANNED** <@${executorId}> for ${reason}.`, 'DarkRed');
            return true;
        } else {
            await sendLog(guild.client, guild.id, '🚨 ANTI-NUKE FAILED', `Could not ban <@${executorId}> (Missing Permissions or Higher Role).`, 'Orange');
            return false;
        }
    } catch (error) {
        console.error('Failed to punish nuker:', error);
    }
}

module.exports = { checkLimit, punishNuker };
