require('dotenv').config();

const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID, // Useful for dev/testing
};

// --- Merged Config ---
config.GLOBAL_COMMANDS = String(process.env.GLOBAL_COMMANDS || 'false').toLowerCase() === 'true';
config.GUILD_IDS = (process.env.GUILD_IDS || process.env.GUILD_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Admin
config.ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

// Spotify (optional)
config.SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
config.SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Role buckets
config.VERIFIED_ROLE_ID_OR_NAME = process.env.VERIFIED_ROLE_ID || 'Verified';
config.ROLE_BUCKETS = {
    AE: process.env.ROLE_AE_ID || 'Group-AE',
    FJ: process.env.ROLE_FJ_ID || 'Group-FJ',
    KO: process.env.ROLE_KO_ID || 'Group-KO',
    PT: process.env.ROLE_PT_ID || 'Group-PT',
    UZ: process.env.ROLE_UZ_ID || 'Group-UZ',
};

// Giveaway
config.REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;
config.REQUIRED_ROLE_NAME = process.env.REQUIRED_ROLE_NAME || 'Verified';
config.BASE_RPC = process.env.BASE_RPC || 'https://mainnet.base.org';
config.USDT_ADDRESS_BASE = process.env.USDT_ADDRESS_BASE || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
config.SENDER_PRIVATE_KEY_BASE = process.env.SENDER_PRIVATE_KEY_BASE;
config.GIVEAWAY_CAP_BASE = Number(process.env.GIVEAWAY_CAP_BASE || '10');
config.CLAIM_AMOUNT_USDT = process.env.CLAIM_AMOUNT_USDT || '10';
config.SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org';
config.SENDER_PRIVATE_KEY_SEPOLIA = process.env.SENDER_PRIVATE_KEY_SEPOLIA;
config.GIVEAWAY_CAP_SEPOLIA = Number(process.env.GIVEAWAY_CAP_SEPOLIA || '10');
config.TEST_ETH_AMOUNT = process.env.TEST_ETH_AMOUNT || '0.005';

// Health check
config.HEALTH_PORT = Number(process.env.HEALTH_PORT || '3000');
config.HEALTH_BIND = process.env.HEALTH_BIND || '0.0.0.0';

// Owner
config.OWNER_ID = process.env.OWNER_ID;
config.BOT_NAME = process.env.BOT_NAME || 'Security Bot';

module.exports = config;
