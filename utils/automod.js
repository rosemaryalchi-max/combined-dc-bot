const { sendLog } = require('./logger');

const BAD_WORDS = ['badword1', 'badword2', 'scam', 'free nitro', 'steam gift']; // Example list

/**
 * Checks message content for violations.
 * @param {Message} message - Discord message object.
 * @returns {boolean} - True if message was deleted/handled.
 */
async function checkAutomod(message) {
    if (message.author.bot) return false;
    if (message.member.permissions.has('ManageMessages')) return false; // Ignore mods

    const content = message.content.toLowerCase();

    // 1. Bad Words Filter
    const foundBadWord = BAD_WORDS.find(word => content.includes(word));
    if (foundBadWord) {
        try {
            await message.delete();
            await message.channel.send(`${message.author}, that word is not allowed.`);
            await sendLog(message.client, message.guild.id, 'Auto-Mod: Bad Word', `Deleted message from ${message.author.tag} containing: ||${foundBadWord}||`, 'Orange');
            return true;
        } catch (e) {
            console.error(e);
        }
    }

    // 2. CAPS LOCK Guard
    // Only check if message is long enough to avoid false positives (e.g. "LOL")
    if (message.content.length > 10) {
        const capsCount = message.content.replace(/[^A-Z]/g, "").length;
        const totalCount = message.content.length;
        if (capsCount / totalCount > 0.7) {
            try {
                await message.delete();
                await message.channel.send(`${message.author}, please stop shouting!`);
                await sendLog(message.client, message.guild.id, 'Auto-Mod: Caps', `Deleted message from ${message.author.tag} (Excessive Caps).`, 'Yellow');
                return true;
            } catch (e) {
                console.error(e);
            }
        }
    }

    return false;
}

module.exports = { checkAutomod };
