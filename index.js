const { Client, Events, GatewayIntentBits, Collection, TextChannel, PermissionFlagsBits } = require('discord.js');
const { token } = require('./config');
const config = require('./config');
const fs = require('node:fs');
const path = require('node:path');
const http = require('http');

// --- MERGED MODULES ---
const { info, ok, warn, err } = require('./utils/logger');
const { musicCommands, onClientReadyMusic, handleInteractionMusic, guildStates } = require('./modules/music');
const { setupRoleBuckets } = require('./modules/roleBuckets');
const { giveawayCommands, handleInteractionGiveaway } = require('./modules/giveaway');
const { adminCommands, handleInteractionAdmin } = require('./modules/adminUtils');
const { registerAllSlashCommands } = require('./commands/register'); // Note: You might need to copy this file too if you haven't

// Error Handling
process.on('unhandledRejection', (e) => err('Unhandled rejection:', e));
process.on('uncaughtException', (e) => err('Uncaught exception:', e));

let isReady = false;

// Health Server
const healthServer = http.createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    if (req.method === 'GET' && path === '/health') {
        res.statusCode = isReady ? 200 : 503;
        res.setHeader('content-type', 'text/plain');
        res.end(isReady ? 'ok' : 'starting');
        return;
    }
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain');
    res.end('not found');
});
healthServer.on('error', (e) => warn('Health server error: ' + (e?.message || e)));
healthServer.listen(config.HEALTH_PORT, config.HEALTH_BIND, () => {
    info(`Health check listening on ${config.HEALTH_BIND}:${config.HEALTH_PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // Added for Music
        GatewayIntentBits.GuildInvites, // Added for Anti-Raid
        GatewayIntentBits.GuildPresences
    ],
});

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Load Events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// Role bucket setup
setupRoleBuckets(client);

// --- Slash Command Registration Helper (Merged) ---
// This registers the *new* commands (music, giveaway, admin) dynamically
// Your existing commands are loaded via client.commands, we can keep that.
// Ideally, we should unify this, but for now, let's load both.

client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    isReady = true;
    ok(`${c.user.tag} is online.`);

    // Initialize Music
    await onClientReadyMusic(client);

    // Initial Security Logs Setup (Existing)
    c.guilds.cache.forEach(async guild => {
        const existingChannel = guild.channels.cache.find(channel => channel.name === 'security-logs' || channel.name === 'mod-logs');
        if (existingChannel) {
            console.log(`Log channel already exists in ${guild.name}`);
        } else {
            try {
                await guild.channels.create({
                    name: 'security-logs',
                    type: 0, // GuildText
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: c.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        }
                    ]
                });
                console.log(`Created security-logs in guild: ${guild.name}`);
            } catch (error) {
                console.error(`Failed to create log channel in ${guild.name}:`, error);
            }
        }
    });
});

// Interaction handling is managed by events/interactionCreate.js

client.login(config.token);
