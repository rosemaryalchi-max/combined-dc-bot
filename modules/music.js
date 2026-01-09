// modules/music.js
const {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  generateDependencyReport,
  demuxProbe,
  NoSubscriberBehavior,
} = require('@discordjs/voice');

const { setDefaultResultOrder } = require('dns');
try { setDefaultResultOrder('ipv4first'); } catch {}

// Core stream libs
const play  = require('play-dl');
const ytdl  = require('@distube/ytdl-core');
const { getGuildConfig } = require('../utils/guildConfig');

// ---- OPTIONAL fallbacks (safe if not installed) ----
let ytDlp = null;
let HAS_YTDLP = false;
try {
  ytDlp = require('yt-dlp-exec');
  HAS_YTDLP = true;
} catch { /* optional */ }

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static'); // absolute path to ffmpeg binary
} catch { /* optional; else use FFMPEG_PATH env or system ffmpeg */ }

// ---- Configs from app config and env ----
const {
  BOT_NAME,
  ADMIN_ROLE_ID,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  YT_COOKIE: CFG_YT_COOKIE,
} = require('../config');

const YT_COOKIE          = CFG_YT_COOKIE || process.env.YT_COOKIE || '';
const USE_YTDL_FALLBACK  = (process.env.USE_YTDL_FALLBACK  ?? '1') === '1';
const USE_YTDLP_FALLBACK = ((process.env.USE_YTDLP_FALLBACK ?? '1') === '1') && HAS_YTDLP;
const ALLOW_PROXY        = (process.env.ALLOW_PROXY        ?? '0') === '1';

// ---- Logger (fallback to console) ----
const { info, ok, warn, err } = require('../utils/logger');

// ---- Proxy guard (prevents invalid URL errors if proxy envs are malformed) ----
(function sanitizeProxyEnv() {
  if (ALLOW_PROXY) {
    info('Proxy envs allowed by ALLOW_PROXY=1');
    return;
  }
  const keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
  const bad = [];
  for (const k of keys) {
    const v = process.env[k];
    if (!v) continue;
    try { new URL(v); } catch { bad.push(`${k}=${JSON.stringify(v)}`); delete process.env[k]; }
  }
  if (bad.length) warn(`Disabled malformed proxy envs: ${bad.join(', ')}`);
})();

// Useful diagnostic once
console.log('\n' + generateDependencyReport());

let sodiumReady = false;
async function ensureVoiceDeps() {
  if (sodiumReady) return;
  try {
    const sodium = require('libsodium-wrappers');
    await sodium.ready;
    sodiumReady = true;
    ok('libsodium-wrappers ready for voice encryption.');
  } catch (e) {
    warn('libsodium-wrappers not available; voice encryption will fail.');
  }
  try {
    require('@discordjs/opus');
  } catch {
    warn('Missing @discordjs/opus; install it for voice playback.');
  }
}

// ---- Per-guild state ----
const guildStates = new Map();
function getGuildState(guildId) {
  let s = guildStates.get(guildId);
  if (!s) {
    s = {
      connection: null,
      player: null,
      isPlaying: false,
      queue: [],
      current: null,
      lastStartMs: 0,
      retryCount: 0,
      volume: 0.6,
      loop: false,
      nowPlayingInteraction: null,
      nowPlayingInteractionAt: 0,
      nowPlayingInterval: null,
      nowPlayingTicks: 0,
      idleTimer: null,
    };
    guildStates.set(guildId, s);
  }
  return s;
}

// ---- Permission / basic helpers ----
function isPrivileged(member) {
  if (!member) return false;
  if (ADMIN_ROLE_ID && member.roles?.cache?.has(ADMIN_ROLE_ID)) return true;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}
function isUrl(s) { try { new URL(s); return true; } catch { return false; } }

// ---- URL canonicalization helpers ----
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
        const t = u.searchParams.get('t') || u.searchParams.get('start');
        return t ? `https://www.youtube.com/watch?v=${id}&t=${t}` : `https://www.youtube.com/watch?v=${id}`;
      }
    }
    return urlStr;
  } catch { return urlStr; }
}
function hasYouTubeVideoId(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return !!url.pathname.slice(1);
    if (['youtube.com', 'music.youtube.com', 'm.youtube.com'].includes(host)) {
      if (url.pathname.startsWith('/shorts/')) return true;
      if (url.pathname === '/watch') return !!url.searchParams.get('v');
    }
    return false;
  } catch { return false; }
}

// ---- Sanitizers ----
function stripDiscordWrappers(s) {
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/^<+/, '').replace(/>+$/, '');
}
function sanitizeUrlLikeInput(s) {
  const raw = stripDiscordWrappers(s);
  return isUrl(raw) ? canonicalizeYouTubeVideo(raw) : raw;
}
function normalizeAndAssert(u) {
  const cleaned = canonicalizeYouTubeVideo(stripDiscordWrappers(u));
  if (!isUrl(cleaned)) throw new Error('Invalid URL (normalized)');
  return cleaned;
}

// ---- Fuzzy search helpers ----
function normalizeText(s) {
  return String(s || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function scoreSearchMatch(query, title, channelName = '') {
  const q = normalizeText(query), t = normalizeText(title), c = normalizeText(channelName);
  if (!q || !t) return 0;
  if (t === q) return 1.0;
  if (t.startsWith(q)) return 0.9;
  const qT = new Set(q.split(' ')), tT = new Set(t.split(' '));
  let overlap = 0; for (const tok of qT) if (tT.has(tok)) overlap++;
  let score = overlap / Math.max(1, qT.size);
  if (c.includes(q)) score += 0.15;
  if (t.includes(q)) score += 0.2;
  return Math.min(1, score);
}

// ---- Voice connection ----
async function ensureConnection(voiceChannel) {
  await ensureVoiceDeps();
  const guildId = voiceChannel.guild.id;
  const state = getGuildState(guildId);
  if (state.connection && state.connection.state.status !== VoiceConnectionStatus.Destroyed) return state.connection;

  state.connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  state.connection.on('stateChange', (o, n) => info(`[${guildId}] Conn: ${o.status} -> ${n.status}`));
  state.connection.on('error', (e) => warn(`[${guildId}] Voice connection error: ${e?.message || e}`));
  state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(state.connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(state.connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      try { state.connection.destroy(); } finally { state.connection = null; }
    }
  });

  try { await entersState(state.connection, VoiceConnectionStatus.Ready, 15_000); }
  catch (e) { state.connection.destroy(); state.connection = null; throw new Error('Failed to connect to voice channel'); }

  try {
    if (voiceChannel.type === ChannelType.GuildStageVoice) {
      const me = await voiceChannel.guild.members.fetch(voiceChannel.client.user.id);
      await me.voice.setSuppressed(false);
    }
  } catch (e) { warn(`[${guildId}] Stage unsuppress failed: ${e.message}`); }
  return state.connection;
}

function scheduleIdleDisconnect(guildId) {
  const state = getGuildState(guildId);
  if (!state.connection) return;
  if (state.idleTimer) clearTimeout(state.idleTimer);
  const cfg = getGuildConfig(guildId);
  const minutes = Number(cfg?.music?.idleMinutes ?? 5);
  if (!minutes || minutes <= 0) return;
  state.idleTimer = setTimeout(() => {
    try {
      if (state.player) state.player.stop(true);
      if (state.connection) state.connection.destroy();
    } catch {}
    state.connection = null;
    state.isPlaying = false;
    state.queue.length = 0;
    state.current = null;
    clearNowPlayingTicker(state);
  }, minutes * 60 * 1000);
}

function clearIdleDisconnect(state) {
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = null;
}

// ---- Audio resource creation (play-dl -> ytdl-core -> yt-dlp) ----
function ytdlOpts(isLive) {
  return {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    liveBuffer: 20_000,
    dlChunkSize: 0,
    filter: 'audioonly',
    requestOptions: YT_COOKIE ? { headers: { cookie: YT_COOKIE } } : undefined,
  };
}

async function streamViaYtDlp(url) {
  if (!HAS_YTDLP) throw new Error('yt-dlp-exec not installed; yt-dlp fallback disabled');

  const ffmpegBin = ffmpegPath || process.env.FFMPEG_PATH;
  if (!ffmpegBin) throw new Error('FFmpeg not found (install ffmpeg-static or set FFMPEG_PATH)');

  // Keep it simple: best Opus (Discord-friendly), else bestaudio.
  // No cookies. No -N (ambiguous in some wrappers). No extra magic.
  const ytdlpArgs = {
    f: 'bestaudio[acodec=opus]/bestaudio/best',
    o: '-',
    'no-playlist': true,
    'no-part': true,
    quiet: true,
    'js-runtimes': 'node',
    ffmpegLocation: ffmpegBin,
    // If you ever want concurrency later, use EXACT key spelling:
    // '-N': '4',
  };

  // Spawn yt-dlp -> stdout
  const child = ytDlp.exec(url, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  // Log stderr so we can see gating/HTTP errors w/out cookies
  child.stderr?.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) warn(`[yt-dlp] ${msg}`);
  });
  child.once('close', (code, signal) => {
    info(`[yt-dlp] exited code=${code} signal=${signal ?? 'null'}`);
  });
  child.once('error', (e) => warn(`yt-dlp spawn error: ${e?.message || e}`));

  // Probe the stdout pipe for container/codec and hand it to Discord
  const probe = await demuxProbe(child.stdout);
  return createAudioResource(probe.stream, { inputType: probe.type, inlineVolume: true });
}

async function createResourceFromUrl(url, opts = {}) {
  const { skipPlayDl = false } = opts;
  const safe = normalizeAndAssert(url);
  const kind = play.yt_validate(safe);
  info(`yt_validate=${kind} | ${safe}`);
  if (!(kind === 'video' || kind === 'yt_video' || kind === 'search')) {
    throw new Error(`Not a YouTube video URL (type=${kind || 'none'})`);
  }

  // 1) play-dl resolve + stream
  let infoObj;
  try { infoObj = await play.video_info(safe); }
  catch (e) { warn(`video_info failed: ${e?.message || e}`); }

  const isLive = !!(infoObj?.live_detail?.is_live || infoObj?.video_details?.live);

  if (!skipPlayDl) {
    if (infoObj && !isLive) {
      try {
        const pl = await play.stream_from_info(infoObj, { quality: 2 });
        if (!pl?.stream) throw new Error('play-dl returned empty stream');
        return createAudioResource(pl.stream, { inputType: pl.type, inlineVolume: true });
      } catch (e) { warn(`stream_from_info failed: ${e?.message || e}`); }
    } else if (isLive) {
      info('Detected LIVE stream; skipping play-dl VOD path');
    }
  } else {
    info('Skipping play-dl path for retry.');
  }

  // 2) ytdl-core fallback
  if (USE_YTDL_FALLBACK) {
    try {
      const ys = ytdl(safe, ytdlOpts(isLive));
      const probe = await demuxProbe(ys);
      return createAudioResource(probe.stream, { inputType: probe.type, inlineVolume: true });
    } catch (e) { warn(`ytdl-core fallback failed: ${e?.message || e}`); }
  }

  // 3) yt-dlp fallback (native extractor)
  if (USE_YTDLP_FALLBACK) {
    try {
      ok('Using yt-dlp fallback pipeline');
      return await streamViaYtDlp(safe);
    } catch (e) { warn(`yt-dlp fallback failed: ${e?.message || e}`); }
  }

  throw new Error(`All streamers failed for "${safe}"`);
}

function embed(color, title, description, fields = []) {
  const e = new EmbedBuilder().setColor(color).setAuthor({ name: BOT_NAME }).setTitle(title).setTimestamp(new Date());
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  return e;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '?:??';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function progressBar(ratio, width = 12) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function buildNowPlayingEmbed(state) {
  const t = state.current;
  if (!t) return embed(0x2ed573, 'Now Playing', 'Nothing is playing.');
  const elapsedSec = Math.max(0, Math.floor((Date.now() - state.lastStartMs) / 1000));
  const isLive = !!t.isLive;
  const totalSec = Number.isFinite(t.durationSec) ? t.durationSec : 0;
  const timeText = isLive ? 'LIVE' : `${formatDuration(elapsedSec)} / ${formatDuration(totalSec)}`;
  const bar = isLive || !totalSec ? '' : progressBar(elapsedSec / totalSec);
  const desc = bar ? `${bar}\n${timeText}` : timeText;
  return embed(0x2ed573, 'Now Playing', `**${t.title}**\n${desc}`, [
    { name: 'URL', value: t.url },
    { name: 'Volume', value: `${Math.round(state.volume * 100)}%`, inline: true },
    { name: 'Loop', value: state.loop ? 'on' : 'off', inline: true },
  ]);
}

function clearNowPlayingTicker(state) {
  if (state.nowPlayingInterval) clearInterval(state.nowPlayingInterval);
  state.nowPlayingInterval = null;
  state.nowPlayingTicks = 0;
}

function setNowPlayingInteraction(state, interaction) {
  state.nowPlayingInteraction = interaction;
  state.nowPlayingInteractionAt = Date.now();
}

function startNowPlayingTicker(state) {
  clearNowPlayingTicker(state);
  if (!state.nowPlayingInteraction || !state.current) return;
  const maxTicks = 8;
  const tickMs = 15000;

  const tick = async () => {
    const tooOld = Date.now() - state.nowPlayingInteractionAt > 10 * 60 * 1000;
    if (tooOld || !state.nowPlayingInteraction || !state.current) return clearNowPlayingTicker(state);
    try {
      await state.nowPlayingInteraction.editReply({ embeds: [buildNowPlayingEmbed(state)] });
    } catch {
      clearNowPlayingTicker(state);
    }
  };

  state.nowPlayingInterval = setInterval(async () => {
    state.nowPlayingTicks += 1;
    if (state.nowPlayingTicks > maxTicks) return clearNowPlayingTicker(state);
    await tick();
  }, tickMs);
  tick().catch(() => {});
}

function applyVolume(resource, state) {
  if (resource?.volume) resource.volume.setVolume(state.volume);
}

// ---- Player lifecycle ----
async function createOrGetPlayer(guildId) {
  const state = getGuildState(guildId);
  if (state.player) return state.player;

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  player.on('stateChange', (o, n) => info(`[${guildId}] Player: ${o.status} -> ${n.status}`));
  player.on('error', (e) => err(`[${guildId}] Player error: ${e}`));
  player.on(AudioPlayerStatus.AutoPaused, () => {
    warn(`[${guildId}] Player auto-paused; attempting resume`);
    if (state.connection) state.connection.subscribe(player);
    try { player.unpause(); } catch {}
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    if (!state.isPlaying) return;
    const startedRecently = Date.now() - state.lastStartMs < 2_000;
    if (state.current && startedRecently && state.retryCount < 1) {
      state.retryCount += 1;
      warn(`[${guildId}] Track ended too quickly; retrying with fallback stream`);
      try {
        const res = await createResourceFromUrl(state.current.url, { skipPlayDl: true });
        if (!res) throw new Error('Failed to create audio resource (retry)');
        applyVolume(res, state);
        state.lastStartMs = Date.now();
        player.play(res);
        startNowPlayingTicker(state);
        return;
      } catch (e) {
        warn(`[${guildId}] Retry failed: ${e?.message || e}`);
      }
    }
    state.retryCount = 0;
    if (state.loop && state.current) {
      try {
        const res = await createResourceFromUrl(state.current.url);
        if (!res) throw new Error('Failed to create audio resource (loop)');
        applyVolume(res, state);
        state.lastStartMs = Date.now();
        player.play(res);
        startNowPlayingTicker(state);
        return;
      } catch (e) {
        warn(`[${guildId}] Loop replay failed, skipping: ${e?.message || e}`);
      }
    }
    state.current = state.queue.shift() || null;
    if (!state.current) {
      state.isPlaying = false;
      clearNowPlayingTicker(state);
      scheduleIdleDisconnect(guildId);
      return;
    }
    try {
      const res = await createResourceFromUrl(state.current.url);
      if (!res) throw new Error('Failed to create audio resource (next track)');
      applyVolume(res, state);
      state.lastStartMs = Date.now();
      player.play(res);
      startNowPlayingTicker(state);
    } catch (e) {
      warn(`[${guildId}] Next track failed, skipping: ${e.message}`);
      player.emit(AudioPlayerStatus.Idle);
    }
  });

  state.player = player;
  return player;
}

async function playTrack(guildId, track) {
  const state = getGuildState(guildId);
  const player = await createOrGetPlayer(guildId);
  if (!state.connection) throw new Error('No voice connection');
  state.connection.subscribe(player);
  state.current = track;
  info(`[${guildId}] Streaming: ${track.title} | ${track.url}`);
  const resource = await createResourceFromUrl(track.url);
  if (!resource) throw new Error('Failed to create audio resource (playTrack)');
  applyVolume(resource, state);
  state.lastStartMs = Date.now();
  state.retryCount = 0;
  clearIdleDisconnect(state);
  player.play(resource);
  state.isPlaying = true;
  startNowPlayingTicker(state);
}

// ---- Spotify helpers ----
function isSpotifyUrl(u) { try { return /spotify\.com$/i.test(new URL(u).hostname.replace(/^www\./,'')); } catch { return false; } }
function toSearchQueryFromSpotifyTrack(spTrack) {
  const artists = Array.isArray(spTrack.artists) ? spTrack.artists : spTrack.artists?.map?.((a) => a.name) || [];
  const artistNames = artists.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(' ');
  const name = spTrack.name || spTrack.title || '';
  return `${name} ${artistNames}`.trim();
}
async function resolveSpotifyInput(url) {
  const sp = await play.spotify(url);
  if (sp.type === 'track') {
    const q = toSearchQueryFromSpotifyTrack(sp);
    const r = await play.search(q, { limit: 1, source: { youtube: 'video' } });
    if (!r.length) throw new Error('No YouTube match found for this Spotify track.');
    return { url: normalizeAndAssert(r[0].url), title: r[0].title || q, durationSec: r[0].durationInSec || 0, isLive: false };
  } else if (sp.type === 'album' || sp.type === 'playlist') {
    const all = await sp.all_tracks();
    const items = [];
    for (const t of all) {
      const q = toSearchQueryFromSpotifyTrack(t);
      const r = await play.search(q, { limit: 1, source: { youtube: 'video' } });
      if (r[0]) items.push({ url: normalizeAndAssert(r[0].url), title: r[0].title || q, durationSec: r[0].durationInSec || 0, isLive: false });
    }
    return items;
  }
  throw new Error('Unsupported Spotify type');
}

async function getTrackMetaFromUrl(url) {
  try {
    const infoV = await play.video_info(url);
    const title = infoV?.video_details?.title || 'Unknown Title';
    const durationSec = Number(infoV?.video_details?.durationInSec || 0);
    const isLive = !!(infoV?.live_detail?.is_live || infoV?.video_details?.live);
    return { title, durationSec, isLive };
  } catch (e) {
    warn(`play.video_info failed in resolveInput: ${e?.message || e}`);
  }
  try {
    const info = await ytdl.getInfo(url);
    const title = info?.videoDetails?.title || 'Unknown Title';
    const durationSec = Number(info?.videoDetails?.lengthSeconds || 0);
    const isLive = !!(info?.videoDetails?.isLiveContent || info?.videoDetails?.isLive);
    return { title, durationSec, isLive };
  } catch (e) {
    warn(`ytdl.getInfo failed in resolveInput: ${e?.message || e}`);
  }
  return { title: 'Unknown Title', durationSec: 0, isLive: false };
}

// ---- Resolve input (URL/playlist/search/fuzzy) ----
async function resolveInput(input) {
  input = sanitizeUrlLikeInput(input);

  if (isUrl(input) && isSpotifyUrl(input)) return await resolveSpotifyInput(input);

  const validated = isUrl(input) ? play.yt_validate(input) : null;

  if (validated === 'video' || validated === 'search') {
    const cleaned = isUrl(input) ? normalizeAndAssert(input) : input;
    if (isUrl(cleaned)) {
      const meta = await getTrackMetaFromUrl(cleaned);
      return { url: normalizeAndAssert(cleaned), title: meta.title, durationSec: meta.durationSec, isLive: meta.isLive };
    }
  }

  if (validated === 'playlist') {
    const cleaned = canonicalizeYouTubeVideo(input);
    if (hasYouTubeVideoId(cleaned)) {
      const meta = await getTrackMetaFromUrl(cleaned);
      return { url: normalizeAndAssert(cleaned), title: meta.title, durationSec: meta.durationSec, isLive: meta.isLive };
    } else {
      try {
        const infoP = await play.playlist_info(cleaned, { incomplete: true });
        const vids = await infoP.all_videos();
        return vids.map((v) => ({
          url: normalizeAndAssert(v.url),
          title: v.title || 'Unknown Title',
          durationSec: v.durationInSec || 0,
          isLive: false,
        }));
      } catch (e) {
        warn(`playlist_info failed: ${e?.message || e}`);
        if (hasYouTubeVideoId(cleaned)) {
          const meta = await getTrackMetaFromUrl(cleaned);
          return { url: normalizeAndAssert(cleaned), title: meta.title, durationSec: meta.durationSec, isLive: meta.isLive };
        }
        throw e;
      }
    }
  }

  // Free-text search
  const SEARCH_LIMIT = 8;
  let results;
  try {
    results = await play.search(input, { limit: SEARCH_LIMIT, source: { youtube: 'video' } });
  } catch (e) {
    throw new Error('Search failed. Try a direct YouTube URL.');
  }
  if (!results.length) throw new Error('No results found');

  let best = null, bestScore = -1;
  for (const r of results) {
    const title = r.title || '';
    const channel = r.channel?.name || r.uploader?.name || '';
    const score = scoreSearchMatch(input, title, channel);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  const chosen = best || results[0];
  return {
    url: normalizeAndAssert(chosen.url),
    title: chosen.title || input,
    durationSec: chosen.durationInSec || 0,
    isLive: false,
  };
}

// ---- Slash commands ----
const musicCommands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play or enqueue a song (YouTube/Spotify URL or search).')
    .addStringOption((o) => o.setName('query').setDescription('URL or search').setRequired(true)),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add to queue (YouTube/Spotify URL or search).')
    .addStringOption((o) => o.setName('query').setDescription('URL or search').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Skip current track (admin only).'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop and clear the queue (admin only).'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback.'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback.'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set playback volume (0-100).')
    .addIntegerOption((o) => o.setName('percent').setDescription('Volume percent').setMinValue(0).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('loop').setDescription('Toggle looping the current track.'),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue.'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue.')
    .addIntegerOption((o) => o.setName('index').setDescription('Queue index (1-based)').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder()
    .setName('idle')
    .setDescription('Set idle disconnect timeout (admin only).')
    .addIntegerOption((o) => o.setName('minutes').setDescription('Idle minutes').setMinValue(1).setMaxValue(120).setRequired(true)),
  new SlashCommandBuilder().setName('queue').setDescription('Show the current queue.'),
  new SlashCommandBuilder().setName('np').setDescription('Show the track currently playing.'),
].map((c) => c.toJSON());

// ---- Ready hook ----
async function onClientReadyMusic(client) {
  await ensureVoiceDeps();
  try {
    if (YT_COOKIE) { await play.setToken({ youtube: { cookie: YT_COOKIE } }); ok('YouTube cookie set for play-dl.'); }
    else { info('YT_COOKIE not provided. Some restricted videos may 403.'); }
  } catch (e) { warn('Could not set YouTube cookie: ' + e.message); }

  try {
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      await play.setToken({ spotify: { client_id: SPOTIFY_CLIENT_ID, client_secret: SPOTIFY_CLIENT_SECRET, market: 'US' } });
      ok('Spotify token set for metadata.');
    } else {
      info('No Spotify creds provided. Spotify URLs still work, may rate-limit sooner.');
    }
  } catch (e) { warn('Could not set Spotify token: ' + e.message); }
}

// ---- Interaction handler ----
async function handleInteractionMusic(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  const name = interaction.commandName;
  if (!['play', 'add', 'skip', 'stop', 'pause', 'resume', 'volume', 'loop', 'shuffle', 'remove', 'idle', 'queue', 'np'].includes(name)) return false;

  try {
    if (name === 'play' || name === 'add') {
      const query = sanitizeUrlLikeInput(interaction.options.getString('query', true));
      const member = interaction.member;
      const vc = member?.voice?.channel;
      if (!vc) { await interaction.reply({ content: 'Join a **voice channel** first.', flags: MessageFlags.Ephemeral }); return true; }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await ensureConnection(vc);
      const resolved = await resolveInput(query);
      const state = getGuildState(interaction.guildId);

      if (Array.isArray(resolved)) {
        if (state.isPlaying || name === 'add') {
          state.queue.push(...resolved);
          await interaction.editReply({ embeds: [embed(0x7289da, 'Playlist Queued', `Queued **${resolved.length}** tracks.`)] });
        } else {
          const first = resolved.shift();
          state.queue.push(...resolved);
          await playTrack(interaction.guildId, first);
          await interaction.editReply({ embeds: [embed(0x9147ff, 'Playing Playlist', `Started: **${first.title}**\nEnqueued **${resolved.length}** more`)] });
          setNowPlayingInteraction(state, interaction);
          startNowPlayingTicker(state);
        }
      } else {
        if (state.isPlaying || name === 'add') {
          state.queue.push(resolved);
          await interaction.editReply({ embeds: [embed(0x7289da, 'Added to Queue', `**${resolved.title}**`, [{ name: 'URL', value: resolved.url }]) ] });
        } else {
          await playTrack(interaction.guildId, resolved);
          await interaction.editReply({ embeds: [embed(0x9147ff, 'Now Playing', `**${resolved.title}**`, [{ name: 'URL', value: resolved.url }]) ] });
          setNowPlayingInteraction(state, interaction);
          startNowPlayingTicker(state);
        }
      }
      return true;
    }

    if (name === 'skip') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!isPrivileged(interaction.member)) { await interaction.editReply({ content: 'Only admins can skip.' }); return true; }
      const state = getGuildState(interaction.guildId);
      if (!state.isPlaying || !state.player) { await interaction.editReply({ content: 'Nothing is playing.' }); return true; }
      state.player.stop(true);
      clearNowPlayingTicker(state);
      await interaction.editReply({ content: 'Skipped.' });
      return true;
    }

    if (name === 'stop') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!isPrivileged(interaction.member)) { await interaction.editReply({ content: 'Only admins can stop.' }); return true; }
      const state = getGuildState(interaction.guildId);
      state.isPlaying = false; state.queue.length = 0; state.current = null;
      clearIdleDisconnect(state);
      try { if (state.player) state.player.stop(true); if (state.connection) { state.connection.destroy(); state.connection = null; } } catch {}
      clearNowPlayingTicker(state);
      await interaction.editReply({ embeds: [embed(0xff4757, 'Stopped', 'Playback stopped and queue cleared.')] });
      return true;
    }

    if (name === 'pause') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = getGuildState(interaction.guildId);
      if (!state.player || !state.isPlaying) { await interaction.editReply({ content: 'Nothing is playing.' }); return true; }
      state.player.pause(true);
      scheduleIdleDisconnect(interaction.guildId);
      await interaction.editReply({ content: 'Paused.' });
      return true;
    }

    if (name === 'resume') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = getGuildState(interaction.guildId);
      if (!state.player || !state.isPlaying) { await interaction.editReply({ content: 'Nothing is playing.' }); return true; }
      try { state.player.unpause(); } catch {}
      clearIdleDisconnect(state);
      await interaction.editReply({ content: 'Resumed.' });
      return true;
    }

    if (name === 'volume') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = getGuildState(interaction.guildId);
      const percent = interaction.options.getInteger('percent', true);
      const vol = Math.max(0, Math.min(100, percent)) / 100;
      state.volume = vol;
      const res = state.player?.state?.resource;
      if (res?.volume) res.volume.setVolume(state.volume);
      await interaction.editReply({ content: `Volume set to ${Math.round(state.volume * 100)}%.` });
      return true;
    }

    if (name === 'loop') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = getGuildState(interaction.guildId);
      state.loop = !state.loop;
      await interaction.editReply({ content: `Loop is now ${state.loop ? 'on' : 'off'}.` });
      return true;
    }

    if (name === 'shuffle') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = getGuildState(interaction.guildId);
      if (state.queue.length < 2) { await interaction.editReply({ content: 'Queue is too short to shuffle.' }); return true; }
      for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
      await interaction.editReply({ content: 'Queue shuffled.' });
      return true;
    }

    if (name === 'remove') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = getGuildState(interaction.guildId);
      if (!state.queue.length) { await interaction.editReply({ content: 'Queue is empty.' }); return true; }
      const idx = interaction.options.getInteger('index', true);
      if (idx < 1 || idx > state.queue.length) { await interaction.editReply({ content: 'Invalid queue index.' }); return true; }
      const [removed] = state.queue.splice(idx - 1, 1);
      await interaction.editReply({ content: `Removed: ${removed.title}` });
      return true;
    }

    if (name === 'idle') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!isPrivileged(interaction.member)) { await interaction.editReply({ content: 'Only admins can change idle timeout.' }); return true; }
      const minutes = interaction.options.getInteger('minutes', true);
      const { updateGuildConfig } = require('../utils/guildConfig');
      updateGuildConfig(interaction.guildId, (cfg) => {
        cfg.music.idleMinutes = minutes;
        return cfg;
      });
      await interaction.editReply({ content: `Idle disconnect set to ${minutes} minute(s).` });
      return true;
    }

    if (name === 'queue') {
      const state = getGuildState(interaction.guildId);
      const lines = [];
      if (state.current) lines.push(`Now: **${state.current.title}**`);
      state.queue.slice(0, 15).forEach((t, i) => lines.push(`${i + 1}. ${t.title}`));
      if (!lines.length) lines.push('Queue is empty.');
      await interaction.reply({ embeds: [embed(0x3742fa, 'Queue', null, [{ name: 'Tracks', value: lines.join('\n') }])], flags: MessageFlags.Ephemeral });
      return true;
    }

    if (name === 'np') {
      const state = getGuildState(interaction.guildId);
      if (!state.current) { await interaction.reply({ content: 'Nothing is playing.', flags: MessageFlags.Ephemeral }); return true; }
      setNowPlayingInteraction(state, interaction);
      await interaction.reply({ embeds: [buildNowPlayingEmbed(state)], flags: MessageFlags.Ephemeral });
      startNowPlayingTicker(state);
      return true;
    }
  } catch (e) {
    if (interaction.deferred || interaction.replied) { await interaction.editReply({ content: 'Something went wrong.' }).catch(() => {}); }
    else { await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {}); }
    err('Music command error: ' + (e?.message || e));
    return true;
  }
}

module.exports = { musicCommands, onClientReadyMusic, handleInteractionMusic, guildStates };
