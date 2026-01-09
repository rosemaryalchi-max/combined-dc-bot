const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- CONSOLE / FILE LOGGER (Merged) ---
const colors = {
    ok: '\x1b[32m',       // green
    info: '\x1b[36m',     // cyan
    warn: '\x1b[33m',     // yellow
    err: '\x1b[31m',      // red
    reset: '\x1b[0m',
};

const ts = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString().replace('T', ' ').slice(0, 19);
};

const logDir = path.join(__dirname, '..', 'logs');
let jsonStream = null;
try {
    fs.mkdirSync(logDir, { recursive: true });
    jsonStream = fs.createWriteStream(path.join(logDir, 'bot.jsonl'), { flags: 'a' });
} catch {
    jsonStream = null;
}

const out = (level, ...args) => {
    const color = colors[level] || '';
    const reset = colors.reset;
    const tag = level.toUpperCase().padEnd(5, ' ');
    const fn = level === 'warn' ? console.warn : level === 'err' ? console.error : console.log;
    fn(`${color}[${ts()}] ${tag}${reset}`, ...args);
    if (jsonStream) {
        try {
            const payload = { ts: ts(), level, msg: args.map(String).join(' ') };
            jsonStream.write(`${JSON.stringify(payload)}\n`);
        } catch { }
    }
};

// --- DISCORD EMBED LOGGER (Original) ---

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

module.exports = {
    sendLog,
    ok: (...a) => out('ok', ...a),
    info: (...a) => out('info', ...a),
    warn: (...a) => out('warn', ...a),
    err: (...a) => out('err', ...a),
};
