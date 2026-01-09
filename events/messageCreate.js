const { Events } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { checkAutomod } = require('../utils/automod');

const userMessageMap = new Map();

// Configuration for anti-spam
const SPAM_LIMIT = 5;
const TIME_WINDOW = 5000; // 5 seconds
const MUTE_DURATION = 60000; // 60 seconds

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        // Auto-Mod Check (Bad Words, Caps)
        if (await checkAutomod(message)) return; // Stop if deleted


        const now = Date.now();
        const authorId = message.author.id;

        // --- EXTENDED SECURITY ---

        // 1. Anti-Link (Discord Invites)
        if (message.content.includes('discord.gg/') || message.content.includes('discord.com/invite/')) {
            if (!message.member.permissions.has('ManageMessages')) { // Ignore mods/admins
                try {
                    await message.delete();
                    await message.channel.send(`${message.author}, sending server invites is not allowed.`);
                    await sendLog(message.client, message.guild.id, 'Anti-Link Triggered', `Deleted invite link from ${message.author.tag} in ${message.channel}.`, 'Orange');
                    return; // Stop processing stats for this message
                } catch (err) {
                    console.error('Failed to delete invite:', err);
                }
            }
        }

        // 2. Mass Mention Protection
        const MENTION_LIMIT = 5;
        if (message.mentions.users.size >= MENTION_LIMIT) {
            if (!message.member.permissions.has('MentionEveryone')) {
                try {
                    await message.delete();
                    if (message.member.moderatable) {
                        await message.member.timeout(60000 * 5, 'Mass Mention Protection'); // 5 min timeout
                        await message.channel.send(`${message.author} has been muted for mass pinging.`);
                    }
                    await sendLog(message.client, message.guild.id, 'Mass Mention Triggered', `User ${message.author.tag} mentioned ${message.mentions.users.size} users. Muted & Deleted.`, 'Red');
                    return;
                } catch (err) {
                    console.error('Failed to handle mass mention:', err);
                }
            }
        }

        // --- END EXTENDED SECURITY ---

        if (!userMessageMap.has(authorId)) {
            userMessageMap.set(authorId, []);
        }

        const userData = userMessageMap.get(authorId);
        userData.push(now);

        // Filter messages outside the time window
        const recentMessages = userData.filter(timestamp => now - timestamp < TIME_WINDOW);
        userMessageMap.set(authorId, recentMessages);

        if (recentMessages.length >= SPAM_LIMIT) {
            try {
                // Determine if we can timeout the member
                if (message.member.moderatable) {
                    await message.member.timeout(MUTE_DURATION, 'Anti-Spam Protection');
                    await message.channel.send(`${message.author} has been muted for ${MUTE_DURATION / 1000}s due to spamming.`);

                    // Log the action
                    await sendLog(
                        message.client,
                        message.guild.id,
                        'Anti-Spam Triggered',
                        `User ${message.author.tag} was muted for spamming in ${message.channel}.`,
                        'Red'
                    );

                    // Clear map for this user to avoid double punishment immediately
                    userMessageMap.delete(authorId);
                }
            } catch (error) {
                console.error('Failed to mute spammer:', error);
            }
        }
    },
};
