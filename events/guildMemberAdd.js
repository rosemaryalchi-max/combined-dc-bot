const { Events } = require('discord.js');
const { sendLog } = require('../utils/logger');

const joinLog = [];
// Anti-Raid Settings
const JOIN_LIMIT = 10;
const TIME_WINDOW_MS = 10000; // 10 seconds

// To prevent spamming logs
let raidMode = false;

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // --- JOIN GATE (Anti-Bot & Anti-No-Avatar) ---

        // 1. Anti-Bot: Kick bots added by unauthorized users
        if (member.user.bot) {
            try {
                const fetchedLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: 28, // AuditLogEvent.BotAdd (28)
                });
                const botAddLog = fetchedLogs.entries.first();

                if (botAddLog) {
                    const { executor } = botAddLog;
                    // Allow if executor has BanMembers permission (Admin/Mod)
                    const executorMember = await member.guild.members.fetch(executor.id);
                    if (!executorMember.permissions.has('BanMembers')) {
                        await member.kick('Unverified Bot (Anti-Bot Gate)');
                        await sendLog(member.client, member.guild.id, '🤖 Unauthorized Bot Kick', `Kicked bot ${member.user.tag} added by ${executor.tag}.`, 'Orange');
                        return;
                    }
                }
            } catch (err) {
                console.error('Anti-Bot Gate Error:', err);
            }
        }

        // 2. Anti-No-Avatar (Optional - can be harsh, maybe warn for now?)
        // Uncomment to enable strict no-avatar kicking
        /*
        if (!member.user.avatar) {
            try {
                 await member.send(`You have been kicked from ${member.guild.name} because you do not have a profile picture.`);
                 await member.kick('No Avatar (Join Gate)');
                 await sendLog(member.client, member.guild.id, 'User Kicked', `Kicked ${member.user.tag} for having no avatar.`, 'Yellow');
                 return;
            } catch (e) {}
        }
        */
        // --- END JOIN GATE ---

        // --- ACCOUNT AGE VERIFICATION ---
        const ACCOUNT_AGE_LIMIT_DAYS = 7;
        const MIN_AGE_MS = ACCOUNT_AGE_LIMIT_DAYS * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const accountCreated = member.user.createdAt.getTime();

        if (now - accountCreated < MIN_AGE_MS) {
            try {
                // Determine action (Kick or Warn). We'll Warn + Kick in this demo.
                await sendLog(
                    member.client,
                    member.guild.id,
                    'Suspicious Account Detected',
                    `User ${member.user.tag} joined with an account created ${(now - accountCreated) / (1000 * 60 * 60 * 24)} days ago. Kicked.`,
                    'Red'
                );

                try {
                    await member.send(`You have been kicked from ${member.guild.name} because your account is too new (must be > 7 days old).`);
                } catch (e) {
                    // ignore if DM closed
                }

                if (member.kickable) {
                    await member.kick('Account too new (Anti-Alt)');
                }
                return; // Stop processing raid stats for this user
            } catch (error) {
                console.error('Failed to kick young account:', error);
            }
        }
        // --- END ACCOUNT AGE VERIFICATION ---

        // const now = Date.now(); // Already defined above
        joinLog.push(now);

        // Remove entries older than the window
        while (joinLog.length > 0 && joinLog[0] < now - TIME_WINDOW_MS) {
            joinLog.shift();
        }

        if (joinLog.length >= JOIN_LIMIT) {
            if (!raidMode) {
                raidMode = true;
                // Log Raid Detection
                await sendLog(
                    member.client,
                    member.guild.id,
                    '🚨 RAID DETECTED 🚨',
                    `High volume of joins detected: ${joinLog.length} users in ${TIME_WINDOW_MS / 1000} seconds.`,
                    'Red'
                );

                // Here you would implement lockdown logic, e.g. disabling invites or verification level increase
                // For this demo, we just log it.

                // Reset raid mode after 1 minute
                setTimeout(() => { raidMode = false; }, 60000);
            }
        }

        // --- WELCOME MESSAGE ---
        try {
            const channel = member.guild.channels.cache.find(ch => ch.name === 'general' || ch.name === 'welcome');
            if (channel) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(`Welcome to ${member.guild.name}!`)
                    .setDescription(`Hello ${member}! You are the **${member.guild.memberCount}th** member.`)
                    .setThumbnail(member.user.displayAvatarURL())
                    .setColor('Random')
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        } catch (e) {
            console.error('Welcome message error:', e);
        }
    },
};
