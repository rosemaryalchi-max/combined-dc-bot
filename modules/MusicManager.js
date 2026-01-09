const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    joinVoiceChannel,
    entersState,
    NoSubscriberBehavior,
    demuxProbe
} = require('@discordjs/voice');
const { ChannelType } = require('discord.js');
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const ytDlp = require('yt-dlp-exec');
const { warn, info, ok, err } = require('../utils/logger');
const { getGuildConfig } = require('../utils/guildConfig');
const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    YT_COOKIE
} = require('../config');

// ... (play-dl init remains here) ...
(async () => {
    try {
        if (YT_COOKIE) {
            await play.setToken({ youtube: { cookie: YT_COOKIE } });
            ok('YouTube cookie set for play-dl.');
        }
        if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
            await play.setToken({ spotify: { client_id: SPOTIFY_CLIENT_ID, client_secret: SPOTIFY_CLIENT_SECRET, market: 'US' } });
            ok('Spotify token set.');
        }
    } catch (e) {
        warn('Failed to set tokens for play-dl: ' + e.message);
    }
})();

// --- Helpers ---
function isUrl(s) { try { new URL(s); return true; } catch { return false; } }

function canonicalizeYouTubeVideo(urlStr) {
    try {
        const u = new URL(urlStr);
        const host = u.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') {
            const id = u.pathname.slice(1);
            return id ? `https://www.youtube.com/watch?v=${id}` : urlStr;
        }
        if (['youtube.com', 'music.youtube.com', 'm.youtube.com'].includes(host)) {
            if (u.pathname.startsWith('/shorts/')) {
                const id = u.pathname.split('/')[2];
                return id ? `https://www.youtube.com/watch?v=${id}` : urlStr;
            }
            if (u.pathname === '/watch' && u.searchParams.get('v')) {
                const id = u.searchParams.get('v');
                return `https://www.youtube.com/watch?v=${id}`;
            }
        }
        return urlStr;
    } catch { return urlStr; }
}

function stripDiscordWrappers(s) {
    return String(s).replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/^<+/, '').replace(/>+$/, '');
}

function normalizeAndAssert(u) {
    const cleaned = canonicalizeYouTubeVideo(stripDiscordWrappers(u));
    if (!isUrl(cleaned)) throw new Error('Invalid URL (normalized)');
    return cleaned;
}

// --- Spotify Check ---
function isSpotifyUrl(u) { try { return /spotify\.com$/i.test(new URL(u).hostname.replace(/^www\./, '')); } catch { return false; } }

async function resolveSpotifyInput(url) {
    if (play.is_expired()) await play.refreshToken();
    const sp = await play.spotify(url);
    const toSearch = async (track) => {
        const artists = track.artists.map(a => a.name).join(' ');
        const q = `${track.name} ${artists}`.trim();
        const r = await play.search(q, { limit: 1, source: { youtube: 'video' } });
        if (r.length) {
            return { title: r[0].title || q, url: r[0].url, durationSec: r[0].durationInSec || 0, isLive: false };
        }
        return null;
    };

    if (sp.type === 'track') {
        const res = await toSearch(sp);
        if (!res) throw new Error('Spotify track not found on YouTube');
        return res;
    } else if (sp.type === 'album' || sp.type === 'playlist') {
        const all = await sp.all_tracks();
        const items = [];
        for (const t of all) {
            const res = await toSearch(t);
            if (res) items.push(res);
        }
        return items;
    }
    throw new Error('Unsupported Spotify type');
}

class MusicManager {
    constructor() {
        this.guilds = new Map();
    }

    getGuildState(guildId) {
        let state = this.guilds.get(guildId);
        if (!state) {
            state = {
                connection: null,
                player: null,
                queue: [],
                current: null,
                volume: 0.6,
                loop: false,
                isPlaying: false,
                idleTimer: null,
                nowPlayingInteraction: null,
                nowPlayingInterval: null
            };
            this.guilds.set(guildId, state);
        }
        return state;
    }

    validateChannel(interaction) {
        const config = getGuildConfig(interaction.guildId);
        const allowedId = config.music?.channelId;

        // 1. Configured Channel
        if (allowedId && interaction.channelId === allowedId) return true;

        // 2. Voice Channel (Text-in-Voice)
        // ChannelType.GuildVoice = 2
        if (interaction.channel.type === ChannelType.GuildVoice) return true;

        return false;
    }

    async connect(voiceChannel) {
        const state = this.getGuildState(voiceChannel.guild.id);
        if (state.connection && state.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            return state.connection;
        }

        state.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(state.connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(state.connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                if (state.connection) state.connection.destroy();
                state.connection = null;
            }
        });

        return state.connection;
    }

    // New helper to create audio resource with fallback
    async createAudioResourceSafe(url, guildId) {
        // 1. Try play-dl
        try {
            const yt_info = await play.video_info(url);
            info(`[${guildId}] [play-dl] Streaming: ${yt_info.video_details.title}`);
            const stream = await play.stream_from_info(yt_info);
            return createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
        } catch (e) {
            warn(`[${guildId}] play-dl failed: ${e.message}. Falling back...`);
        }

        // 2. Try @distube/ytdl-core
        try {
            info(`[${guildId}] [ytdl] Attempting fallback...`);
            // Attempt to use cookie if available via options (ytdl-core options are limited but let's try basic)
            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                requestOptions: {
                    headers: {
                        cookie: YT_COOKIE || ''
                    }
                }
            });
            const probe = await demuxProbe(stream);
            info(`[${guildId}] [ytdl] Fallback success.`);
            return createAudioResource(probe.stream, { inputType: probe.type, inlineVolume: true });
        } catch (e) {
            warn(`[${guildId}] ytdl-core failed: ${e.message}. Falling back to yt-dlp...`);
        }

        // 3. Try yt-dlp (Nuclear Option)
        try {
            info(`[${guildId}] [yt-dlp] Attempting native binary fallback...`);
            // yt-dlp-exec usage: exec(url, flags) returns a subprocess
            const subprocess = ytDlp.exec(url, {
                o: '-',
                f: 'bestaudio',
                q: true,
                noWarnings: true,
                preferFreeFormats: true,
                cookies: undefined // Can't easily pass cookie string here without a file, relying on network/no-cookie
            });

            // Create a resource from the stdout stream
            const probe = await demuxProbe(subprocess.stdout);
            info(`[${guildId}] [yt-dlp] Fallback success.`);
            return createAudioResource(probe.stream, { inputType: probe.type, inlineVolume: true });
        } catch (e) {
            throw new Error(`All methods failed (play-dl, ytdl, yt-dlp). Last error: ${e.message}`);
        }
    }

    async play(guildId, track) {
        const state = this.getGuildState(guildId);
        if (!state.connection) throw new Error('No voice connection');

        if (!state.player) {
            this.createPlayer(guildId);
            state.connection.subscribe(state.player);
        }

        try {
            info(`[${guildId}] Preparing to play: ${track.url}`);

            const resource = await this.createAudioResourceSafe(track.url, guildId);
            resource.volume.setVolume(state.volume);

            state.player.play(resource);
            state.current = track;
            state.isPlaying = true;

        } catch (error) {
            err(`[${guildId}] Play error: ${error.message} (URL: ${track.url})`);
            this.processQueue(guildId); // Try next
        }
    }

    createPlayer(guildId) {
        const state = this.getGuildState(guildId);
        state.player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });

        state.player.on(AudioPlayerStatus.Idle, () => {
            if (state.loop && state.current) {
                this.play(guildId, state.current);
            } else {
                this.processQueue(guildId);
            }
        });

        state.player.on('error', error => {
            err(`[${guildId}] Player Error: ${error.message}`);
            this.processQueue(guildId);
        });
    }

    processQueue(guildId) {
        const state = this.getGuildState(guildId);
        const next = state.queue.shift();
        if (next) {
            this.play(guildId, next);
        } else {
            state.isPlaying = false;
            state.current = null;
            this.startIdleTimer(guildId);
        }
    }

    // --- New Methods ---
    toggleLoop(guildId) {
        const state = this.getGuildState(guildId);
        state.loop = !state.loop;
        return state.loop;
    }

    shuffleQueue(guildId) {
        const state = this.getGuildState(guildId);
        if (state.queue.length < 2) return;
        for (let i = state.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
    }

    removeFromQueue(guildId, index) {
        const state = this.getGuildState(guildId);
        if (index >= 0 && index < state.queue.length) {
            return state.queue.splice(index, 1)[0];
        }
        return null;
    }

    disconnect(guildId) {
        const state = this.getGuildState(guildId);
        if (state.connection) {
            state.connection.destroy();
            state.connection = null;
        }
        if (state.idleTimer) clearTimeout(state.idleTimer);
        state.queue = [];
        state.current = null;
        state.isPlaying = false;
        info(`[${guildId}] Disconnected due to inactivity or empty channel.`);
    }

    startIdleTimer(guildId) {
        const state = this.getGuildState(guildId);
        if (state.idleTimer) clearTimeout(state.idleTimer);

        const config = getGuildConfig(guildId);
        const timeout = (config.music?.idleMinutes || 0.5) * 60 * 1000;

        state.idleTimer = setTimeout(() => {
            if (!state.isPlaying && state.connection) {
                this.disconnect(guildId);
            }
        }, timeout);
    }

    // Call this from voiceStateUpdate event
    handleVoiceStateUpdate(oldState, newState) {
        const guildId = oldState.guild.id || newState.guild.id;
        const state = this.getGuildState(guildId);

        if (!state.connection) return;

        // Check if the bot's channel is now empty (excluding itself)
        const botChannelId = state.connection.joinConfig.channelId;
        const channel = oldState.guild.channels.cache.get(botChannelId);

        if (channel && channel.members.size === 1) { // Only bot remains
            this.disconnect(guildId);
        }
    }

    async search(query) {
        const input = stripDiscordWrappers(query);

        if (isUrl(input)) {
            if (isSpotifyUrl(input)) {
                return await resolveSpotifyInput(input);
            }

            const validation = play.yt_validate(input);
            if (validation === 'video') {
                const info = await play.video_info(input);
                return [{
                    title: info.video_details.title,
                    url: info.video_details.url,
                    duration: info.video_details.durationInSec,
                    isLive: info.video_details.isLive
                }];
            }
            if (validation === 'playlist') {
                const playlist = await play.playlist_info(input, { incomplete: true });
                const videos = await playlist.all_videos();
                return videos.map(v => ({
                    title: v.title,
                    url: v.url,
                    duration: v.durationInSec,
                    isLive: false // Playlist items usually VODs
                }));
            }
        }

        // Search
        const results = await play.search(input, { limit: 1, source: { youtube: 'video' } });
        if (results.length > 0) {
            return [{
                title: results[0].title,
                url: results[0].url,
                duration: results[0].durationInSec,
                isLive: results[0].live
            }];
        }
        return [];
    }
}

module.exports = new MusicManager();
