const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'guild_config.json');

function defaultGuildConfig() {
    return {
        logChannelId: null,
        welcomeChannelId: null, // New field for welcome messages
        welcome: {
            card: {
                enabled: false,
                theme: 'gaming', // gaming, anime, nature, abstract
                title: 'Welcome to {server}!',
                text: 'Hey {user}, nice to see you!',
            }
        },
        panic: {
            enabled: false, // Auto-lockdown on raid
            message: 'Server is currently under lockdown due to a raid.',
        },
        faucet: {
            caps: { base: 10, sepolia: 10 },
            cooldownHours: 24,
            whitelist: [],
            blacklist: [],
        },
        music: {
            idleMinutes: 0.5, // 30 seconds
            channelId: null, // New field for music channel restriction
        },
        ticket: { // New ticket configuration
            supportRoleId: null,
            channelName: 'ticket-{username}',
            welcomeMessage: 'Hello {user}, support will be with you shortly.',
            transcriptChannelId: null,
            categoryOpenId: null,
            categoryClosedId: null,
            count: 0,
        },
    };
}

function normalizeGuildConfig(cfg) {
    const d = defaultGuildConfig();
    return {
        logChannelId: cfg?.logChannelId ?? d.logChannelId,
        welcomeChannelId: cfg?.welcomeChannelId ?? d.welcomeChannelId,
        welcome: { // New detailed welcome config
            card: {
                enabled: !!(cfg?.welcome?.card?.enabled ?? d.welcome.card.enabled),
                theme: cfg?.welcome?.card?.theme ?? d.welcome.card.theme,
                title: cfg?.welcome?.card?.title ?? d.welcome.card.title,
                text: cfg?.welcome?.card?.text ?? d.welcome.card.text,
            }
        },
        musicChannelId: cfg?.musicChannelId ?? d.musicChannelId,
        faucetChannelId: cfg?.faucetChannelId ?? d.faucetChannelId,
        modRoleId: cfg?.modRoleId ?? d.modRoleId,

        panic: {
            enabled: !!(cfg?.panic?.enabled ?? d.panic.enabled),
            message: cfg?.panic?.message ?? d.panic.message,
        },
        faucet: {
            caps: {
                // Support legacy 'giveaway' config during migration if needed, or just default to new 'faucet'
                base: Number(cfg?.faucet?.caps?.base ?? cfg?.giveaway?.caps?.base ?? d.faucet.caps.base),
                sepolia: Number(cfg?.faucet?.caps?.sepolia ?? cfg?.giveaway?.caps?.sepolia ?? d.faucet.caps.sepolia),
            },
            cooldownHours: Number(cfg?.faucet?.cooldownHours ?? cfg?.giveaway?.cooldownHours ?? d.faucet.cooldownHours),
            whitelist: Array.isArray(cfg?.faucet?.whitelist) ? cfg.faucet.whitelist : [],
            blacklist: Array.isArray(cfg?.faucet?.blacklist) ? cfg.faucet.blacklist : [],
        },
        music: {
            idleMinutes: Number(cfg?.music?.idleMinutes ?? d.music.idleMinutes),
            channelId: cfg?.music?.channelId ?? d.music.channelId,
        },
        ticket: {
            supportRoleId: cfg?.ticket?.supportRoleId ?? d.ticket.supportRoleId,
            channelName: cfg?.ticket?.channelName ?? d.ticket.channelName,
            welcomeMessage: cfg?.ticket?.welcomeMessage ?? d.ticket.welcomeMessage,
            transcriptChannelId: cfg?.ticket?.transcriptChannelId ?? d.ticket.transcriptChannelId,
            categoryOpenId: cfg?.ticket?.categoryOpenId ?? d.ticket.categoryOpenId,
            categoryClosedId: cfg?.ticket?.categoryClosedId ?? d.ticket.categoryClosedId,
            count: Number(cfg?.ticket?.count ?? d.ticket.count),
        },
    };
}

function loadAll() {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch { return {}; }
}

function saveAll(all) {
    const tmp = `${CONFIG_FILE}.tmp`; // Atomic save
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
    fs.renameSync(tmp, CONFIG_FILE);
}

function getGuildConfig(guildId) {
    const all = loadAll();
    return normalizeGuildConfig(all[guildId]);
}

function updateGuildConfig(guildId, updater) {
    const all = loadAll();
    const current = normalizeGuildConfig(all[guildId]);
    const next = updater(current) || current;
    all[guildId] = next;
    saveAll(all);
    return next;
}

module.exports = {
    getGuildConfig,
    updateGuildConfig,
    defaultGuildConfig,
};
