const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { ethers } = require('ethers');
const cfg2 = require('../config');
const { warn, err } = require('../utils/logger');
const { getGuildConfig, updateGuildConfig } = require('../utils/guildConfig');
const { loadGlobalConfig, updateGlobalConfig } = require('../utils/globalConfig');

// Providers & wallets
const provBase = new ethers.JsonRpcProvider(cfg2.BASE_RPC);
const provSepo = new ethers.JsonRpcProvider(cfg2.SEPOLIA_RPC);
const walletBase = cfg2.SENDER_PRIVATE_KEY_BASE ? new ethers.Wallet(cfg2.SENDER_PRIVATE_KEY_BASE, provBase) : null;
const walletSepo = cfg2.SENDER_PRIVATE_KEY_SEPOLIA ? new ethers.Wallet(cfg2.SENDER_PRIVATE_KEY_SEPOLIA, provSepo) : null;

// Base USDT ERC20
const usdtBase = walletBase ? new ethers.Contract(
  cfg2.USDT_ADDRESS_BASE,
  [ 'function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address account) view returns (uint256)', 'function decimals() view returns (uint8)' ],
  walletBase
) : null;

// Persistent state (shared file + lock)
const STATE_FILE = path.join(__dirname, '..', 'giveaway_state.json');
const LOCK_FILE = `${STATE_FILE}.lock`;
function defaultState() {
  return {
    base: { total: 0, users: {}, txs: [], attempts: [], paused: false },
    sepolia: { total: 0, users: {}, txs: [], attempts: [], paused: false },
  };
}
function normalizeState(s) {
  const base = s?.base || {};
  const sepolia = s?.sepolia || {};
  return {
    base: {
      total: Number(base.total || 0),
      users: base.users || {},
      txs: Array.isArray(base.txs) ? base.txs : [],
      attempts: Array.isArray(base.attempts) ? base.attempts : [],
      paused: Boolean(base.paused),
    },
    sepolia: {
      total: Number(sepolia.total || 0),
      users: sepolia.users || {},
      txs: Array.isArray(sepolia.txs) ? sepolia.txs : [],
      attempts: Array.isArray(sepolia.attempts) ? sepolia.attempts : [],
      paused: Boolean(sepolia.paused),
    },
  };
}
function loadState() {
  try { return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); }
  catch { return defaultState(); }
}
function saveState(s) {
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}
let state = loadState();

async function withLock(fn) {
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      try { return await fn(); }
      finally { fs.closeSync(fd); fs.unlinkSync(LOCK_FILE); }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() - start > 5000) throw new Error('Lock timeout');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

function pushAttempt(s, stateKey, payload) {
  const list = s[stateKey].attempts;
  list.push(payload);
  if (list.length > 2000) list.splice(0, list.length - 2000);
}

// Helpers
function isAdmin(member) {
  if (!member) return false;
  if (cfg2.ADMIN_ROLE_ID && member.roles?.cache?.has(cfg2.ADMIN_ROLE_ID)) return true;
  return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}
function isOwner(userId) {
  return Boolean(cfg2.OWNER_ID && String(cfg2.OWNER_ID) === String(userId));
}
function hasRequiredRole(member) {
  if (cfg2.REQUIRED_ROLE_ID) return member.roles.cache.has(cfg2.REQUIRED_ROLE_ID);
  return member.roles.cache.some((r) => r.name.toLowerCase() === cfg2.REQUIRED_ROLE_NAME.toLowerCase());
}
const isAddr = (a) => ethers.isAddress(a);
async function isEOA(addr, provider) { const code = await provider.getCode(addr); return code === '0x'; }
function fmtUnits(n, dec) {
  try {
    const s = ethers.formatUnits(n, dec);
    const f = parseFloat(s);
    if (isNaN(f)) return s;
    return f.toLocaleString(undefined, { maximumFractionDigits: dec });
  } catch (e) {
    warn('fmtUnits error: ' + e.message);
    return n.toString();
  }
}
async function balancesSnapshot() {
  const [dec, uBal, bEth, sEth] = await Promise.all([
    usdtBase?.decimals?.().catch(() => 6) ?? 6,
    usdtBase?.balanceOf?.(walletBase.address) ?? 0n,
    provBase.getBalance(walletBase?.address || ethers.ZeroAddress),
    provSepo.getBalance(walletSepo?.address || ethers.ZeroAddress),
  ]);
  return { dec, uBal, bEth, sEth };
}

const CLAIM_CHOICES = [];
if (walletBase && usdtBase) CLAIM_CHOICES.push({ name: 'base-usdt (mainnet)', value: 'base-usdt' });
if (walletSepo) CLAIM_CHOICES.push({ name: 'sepolia-eth (testnet)', value: 'sepolia-eth' });

const NETWORK_CHOICES = [...CLAIM_CHOICES];
if (CLAIM_CHOICES.length > 1) NETWORK_CHOICES.push({ name: 'all', value: 'all' });

const giveawayCommands = [
  new SlashCommandBuilder().setName('status').setDescription('Show giveaway status for both networks').toJSON(),
];
if (NETWORK_CHOICES.length) {
  giveawayCommands.push(
    new SlashCommandBuilder().setName('giveaway_pause').setDescription('Pause giveaways (admin only)')
      .addStringOption((o) => o.setName('network').setDescription('Network to pause').addChoices(...NETWORK_CHOICES).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_resume').setDescription('Resume giveaways (admin only)')
      .addStringOption((o) => o.setName('network').setDescription('Network to resume').addChoices(...NETWORK_CHOICES).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_export').setDescription('Export claims CSV (admin only)')
      .addStringOption((o) => o.setName('network').setDescription('Network to export').addChoices(...NETWORK_CHOICES).setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_set_cap').setDescription('Set giveaway cap (admin only)')
      .addStringOption((o) => o.setName('network').setDescription('Network').addChoices(...CLAIM_CHOICES).setRequired(true))
      .addIntegerOption((o) => o.setName('cap').setDescription('Max claims').setMinValue(1).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_set_cooldown').setDescription('Set giveaway cooldown hours (admin only)')
      .addIntegerOption((o) => o.setName('hours').setDescription('Cooldown hours').setMinValue(1).setMaxValue(168).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_whitelist_add').setDescription('Add user to guild whitelist (admin only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_whitelist_remove').setDescription('Remove user from guild whitelist (admin only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_blacklist_add').setDescription('Add user to guild blacklist (admin only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_blacklist_remove').setDescription('Remove user from guild blacklist (admin only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_global_whitelist_add').setDescription('Add user to global whitelist (owner only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_global_whitelist_remove').setDescription('Remove user from global whitelist (owner only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_global_blacklist_add').setDescription('Add user to global blacklist (owner only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),
    new SlashCommandBuilder().setName('giveaway_global_blacklist_remove').setDescription('Remove user from global blacklist (owner only)')
      .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
      .toJSON(),
  );
}
if (CLAIM_CHOICES.length) {
  const claimCmd = new SlashCommandBuilder().setName('claim').setDescription('FCFS claim: Base USDT (mainnet) or Sepolia test ETH')
    .addStringOption((o) => {
      o.setName('network').setDescription('Choose network/asset').setRequired(true);
      o.addChoices(...CLAIM_CHOICES);
      return o;
    })
    .addStringOption((o) => o.setName('address').setDescription('Your wallet address (EOA)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .toJSON();
  giveawayCommands.unshift(claimCmd);
}

function appendClaimsCsv(rows, network, s) {
  for (const tx of s.txs) {
    const ts = tx.ts ? new Date(tx.ts).toISOString() : '';
    rows.push([network, tx.userId, tx.address, tx.txHash, tx.blockNumber ?? '', ts]);
  }
}

function getGuildSettings(guildId) {
  const gcfg = getGuildConfig(guildId);
  return {
    caps: {
      base: Number(gcfg.giveaway.caps.base || cfg2.GIVEAWAY_CAP_BASE),
      sepolia: Number(gcfg.giveaway.caps.sepolia || cfg2.GIVEAWAY_CAP_SEPOLIA),
    },
    cooldownHours: Number(gcfg.giveaway.cooldownHours || 24),
    whitelist: gcfg.giveaway.whitelist || [],
    blacklist: gcfg.giveaway.blacklist || [],
  };
}

async function handleInteractionGiveaway(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  const name = interaction.commandName;
  const known = [
    'claim', 'status', 'giveaway_pause', 'giveaway_resume', 'giveaway_export',
    'giveaway_set_cap', 'giveaway_set_cooldown',
    'giveaway_whitelist_add', 'giveaway_whitelist_remove',
    'giveaway_blacklist_add', 'giveaway_blacklist_remove',
    'giveaway_global_whitelist_add', 'giveaway_global_whitelist_remove',
    'giveaway_global_blacklist_add', 'giveaway_global_blacklist_remove',
  ];
  if (!known.includes(name)) return false;

  const guildId = interaction.guildId;
  const gSettings = getGuildSettings(guildId);
  const gcfg = getGuildConfig(guildId);
  const globalCfg = loadGlobalConfig();

  if (name === 'status') {
    state = loadState();
    const remainBase = Math.max(0, gSettings.caps.base - state.base.total);
    const remainSepo = Math.max(0, gSettings.caps.sepolia - state.sepolia.total);
    const { dec, uBal, bEth, sEth } = await balancesSnapshot();

    const baseRecent = state.base.txs.slice(-5).map((t) => `${t.userId} ${t.txHash}`).join('\n') || 'None';
    const sepoRecent = state.sepolia.txs.slice(-5).map((t) => `${t.userId} ${t.txHash}`).join('\n') || 'None';

    await interaction.reply({ ephemeral: true, content:
`FCFS Status
` +
`- Base USDT: ${state.base.total}/${gSettings.caps.base} claimed | Remaining: ${remainBase} | Paused: ${state.base.paused ? 'yes' : 'no'}
` +
`  Bot USDT: ${fmtUnits(uBal, dec)} | Bot ETH on Base: ${ethers.formatEther(bEth)}
` +
`  Recent claims:
${baseRecent}
` +
`- Sepolia ETH: ${state.sepolia.total}/${gSettings.caps.sepolia} claimed | Remaining: ${remainSepo} | Paused: ${state.sepolia.paused ? 'yes' : 'no'}
` +
`  Bot ETH on Sepolia: ${ethers.formatEther(sEth)}
` +
`  Recent claims:
${sepoRecent}
` +
`- Cooldown: ${gSettings.cooldownHours} hour(s)` });
    return true;
  }

  if (name === 'giveaway_pause' || name === 'giveaway_resume') {
    await interaction.deferReply({ ephemeral: true });
    if (!isAdmin(interaction.member)) { await interaction.editReply('Admin only.'); return true; }
    const network = interaction.options.getString('network', true);
    const paused = name === 'giveaway_pause';

    await withLock(async () => {
      state = loadState();
      if (network === 'all') {
        state.base.paused = paused;
        state.sepolia.paused = paused;
      } else if (network === 'base-usdt') {
        state.base.paused = paused;
      } else if (network === 'sepolia-eth') {
        state.sepolia.paused = paused;
      }
      saveState(state);
    });

    await interaction.editReply(paused ? 'Giveaway paused.' : 'Giveaway resumed.');
    return true;
  }

  if (name === 'giveaway_export') {
    await interaction.deferReply({ ephemeral: true });
    if (!isAdmin(interaction.member)) { await interaction.editReply('Admin only.'); return true; }
    const network = interaction.options.getString('network') || 'all';
    state = loadState();

    const rows = [['network', 'userId', 'address', 'txHash', 'blockNumber', 'ts']];
    if (network === 'all' || network === 'base-usdt') appendClaimsCsv(rows, 'base-usdt', state.base);
    if (network === 'all' || network === 'sepolia-eth') appendClaimsCsv(rows, 'sepolia-eth', state.sepolia);

    const csv = rows.map((r) => r.map((v) => String(v).replace(/"/g, '""')).map((v) => `"${v}"`).join(',')).join('\n');
    const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf8'), { name: 'giveaway_export.csv' });
    await interaction.editReply({ files: [attachment] });
    return true;
  }

  if (name === 'giveaway_set_cap') {
    await interaction.deferReply({ ephemeral: true });
    if (!isAdmin(interaction.member)) { await interaction.editReply('Admin only.'); return true; }
    const network = interaction.options.getString('network', true);
    const cap = interaction.options.getInteger('cap', true);
    updateGuildConfig(guildId, (cfg) => {
      if (network === 'base-usdt') cfg.giveaway.caps.base = cap;
      if (network === 'sepolia-eth') cfg.giveaway.caps.sepolia = cap;
      return cfg;
    });
    await interaction.editReply(`Cap set to ${cap} for ${network}.`);
    return true;
  }

  if (name === 'giveaway_set_cooldown') {
    await interaction.deferReply({ ephemeral: true });
    if (!isAdmin(interaction.member)) { await interaction.editReply('Admin only.'); return true; }
    const hours = interaction.options.getInteger('hours', true);
    updateGuildConfig(guildId, (cfg) => {
      cfg.giveaway.cooldownHours = hours;
      return cfg;
    });
    await interaction.editReply(`Cooldown set to ${hours} hour(s).`);
    return true;
  }

  if (name === 'giveaway_whitelist_add' || name === 'giveaway_whitelist_remove' || name === 'giveaway_blacklist_add' || name === 'giveaway_blacklist_remove') {
    await interaction.deferReply({ ephemeral: true });
    if (!isAdmin(interaction.member)) { await interaction.editReply('Admin only.'); return true; }
    const user = interaction.options.getUser('user', true);
    const key = name.includes('whitelist') ? 'whitelist' : 'blacklist';
    const add = name.includes('_add');
    updateGuildConfig(guildId, (cfg) => {
      const list = cfg.giveaway[key] || [];
      const id = String(user.id);
      const has = list.includes(id);
      if (add && !has) list.push(id);
      if (!add && has) cfg.giveaway[key] = list.filter((x) => x != id);
      cfg.giveaway[key] = list;
      return cfg;
    });
    await interaction.editReply(`${add ? 'Added' : 'Removed'} ${user.tag} ${add ? 'to' : 'from'} ${key}.`);
    return true;
  }

  if (name === 'giveaway_global_whitelist_add' || name === 'giveaway_global_whitelist_remove' || name === 'giveaway_global_blacklist_add' || name === 'giveaway_global_blacklist_remove') {
    await interaction.deferReply({ ephemeral: true });
    if (!isOwner(interaction.user.id)) { await interaction.editReply('Owner only.'); return true; }
    const user = interaction.options.getUser('user', true);
    const key = name.includes('whitelist') ? 'whitelist' : 'blacklist';
    const add = name.includes('_add');
    updateGlobalConfig((cfg) => {
      const list = cfg.giveaway[key] || [];
      const id = String(user.id);
      const has = list.includes(id);
      if (add && !has) list.push(id);
      if (!add && has) cfg.giveaway[key] = list.filter((x) => x != id);
      cfg.giveaway[key] = list;
      return cfg;
    });
    await interaction.editReply(`${add ? 'Added' : 'Removed'} ${user.tag} ${add ? 'to' : 'from'} global ${key}.`);
    return true;
  }

  if (name === 'claim') {
    await interaction.deferReply({ ephemeral: true });
    try {
      if (!CLAIM_CHOICES.length) { await interaction.editReply('Faucet is not configured.'); return true; }
      const member = interaction.member ?? await interaction.guild.members.fetch(interaction.user.id);
      if (!hasRequiredRole(member)) { await interaction.editReply('You must have the required role to claim.'); return true; }
      const network = interaction.options.getString('network');
      const addr = interaction.options.getString('address').trim();
      if (!isAddr(addr)) { await interaction.editReply('Invalid address. Provide a valid 0x EOA.'); return true; }

      const gidWhitelist = gSettings.whitelist || [];
      const gidBlacklist = gSettings.blacklist || [];
      const globalWhitelist = globalCfg.giveaway.whitelist || [];
      const globalBlacklist = globalCfg.giveaway.blacklist || [];
      const userId = String(interaction.user.id);

      if (globalBlacklist.includes(userId) || gidBlacklist.includes(userId)) {
        await interaction.editReply('You are not allowed to claim.');
        return true;
      }
      if ((globalWhitelist.length || gidWhitelist.length) && !(globalWhitelist.includes(userId) || gidWhitelist.includes(userId))) {
        await interaction.editReply('You are not whitelisted to claim.');
        return true;
      }

      const ctx = (network === 'base-usdt' && walletBase && usdtBase) ? {
        name: 'Base USDT', prov: provBase, cap: gSettings.caps.base, stateKey: 'base',
        send: async () => {
          const dec = await (usdtBase?.decimals?.().catch(() => 6) ?? 6);
          const amount = ethers.parseUnits(cfg2.CLAIM_AMOUNT_USDT, dec);
          const [bal, eth] = await Promise.all([ usdtBase.balanceOf(walletBase.address), provBase.getBalance(walletBase.address) ]);
          if (bal < amount) return { ok: false, msg: `Bot USDT balance too low: ${fmtUnits(bal, dec)} USDT` };
          if (eth === 0n) return { ok: false, msg: 'Bot has no ETH for gas on Base.' };
          const tx = await usdtBase.transfer(addr, amount); const rc = await tx.wait();
          return { ok: true, txHash: tx.hash, blockNumber: rc.blockNumber, human: `${cfg2.CLAIM_AMOUNT_USDT} USDT` };
        },
      } : (network === 'sepolia-eth' && walletSepo) ? {
        name: 'Sepolia ETH', prov: provSepo, cap: gSettings.caps.sepolia, stateKey: 'sepolia',
        send: async () => {
          const amountWei = ethers.parseEther(cfg2.TEST_ETH_AMOUNT);
          const bal = await provSepo.getBalance(walletSepo.address);
          if (bal < amountWei) return { ok: false, msg: `Faucet low: have ${ethers.formatEther(bal)} ETH, need ${cfg2.TEST_ETH_AMOUNT}.` };
          const tx = await walletSepo.sendTransaction({ to: addr, value: amountWei }); const rc = await tx.wait();
          return { ok: true, txHash: tx.hash, blockNumber: rc.blockNumber, human: `${cfg2.TEST_ETH_AMOUNT} ETH` };
        },
      } : null;

      if (!ctx) { await interaction.editReply('That network is not available.'); return true; }
      if (!(await isEOA(addr, ctx.prov))) { await interaction.editReply('That address is a contract on the selected network. Use a normal wallet (EOA).'); return true; }

      const result = await withLock(async () => {
        state = loadState();
        const s = state[ctx.stateKey];
        if (s.paused) return { ok: false, msg: 'Giveaway is paused for this network.' };
        if (s.total >= ctx.cap) return { ok: false, msg: 'Cap reached for this network.' };
        const last = s.users[userId];
        if (last?.ts) {
          const elapsed = Date.now() - Number(last.ts);
          const cooldownMs = gSettings.cooldownHours * 60 * 60 * 1000;
          if (elapsed < cooldownMs) {
            const remain = Math.ceil((cooldownMs - elapsed) / 60000);
            return { ok: false, msg: `Cooldown active. Try again in ${remain} minute(s).` };
          }
        }
        const sent = await ctx.send();
        if (!sent.ok) return sent;
        const ts = Date.now();
        s.total += 1; s.users[userId] = { address: addr, txHash: sent.txHash, ts };
        s.txs.push({ userId, address: addr, txHash: sent.txHash, blockNumber: sent.blockNumber, ts });
        pushAttempt(state, ctx.stateKey, { userId, address: addr, ts, ok: true, txHash: sent.txHash });
        saveState(state);
        return { ok: true, ...sent, idx: s.total };
      });

      if (!result.ok) {
        await withLock(async () => {
          state = loadState();
          pushAttempt(state, ctx.stateKey, { userId, address: addr, ts: Date.now(), ok: false, reason: result.msg });
          saveState(state);
        });
        await interaction.editReply(result.msg);
        return true;
      }
      const explorer = (network === 'base-usdt') ? 'https://basescan.org/tx/' : 'https://sepolia.etherscan.io/tx/';
      await interaction.editReply(`Claim success for ${ctx.name}. Amount: ${result.human}. Index: #${result.idx}. Tx: ${explorer}${result.txHash}`);
      return true;
    } catch (e) {
      await interaction.editReply(`Claim failed: ${e?.data?.message || e?.message || String(e)}`);
      err('Giveaway error: ' + (e?.message || e));
      return true;
    }
  }

  return false;
}

module.exports = { giveawayCommands, handleInteractionGiveaway };
