const { Events, GatewayIntentBits, Partials } = require('discord.js');
const { VERIFIED_ROLE_ID_OR_NAME, ROLE_BUCKETS } = require('../config');
const logger = require('../utils/logger');
const info = logger?.info || ((...a) => console.log('ℹ️', ...a));
const ok   = logger?.ok   || ((...a) => console.log('✅', ...a));
const warn = logger?.warn || ((...a) => console.warn('⚠️', ...a));
const err  = logger?.err  || ((...a) => console.error('❌', ...a));


const isSnowflake = (s) => typeof s === 'string' && /^\d{17,20}$/.test(s);
async function resolveRole(guild, idOrName) {
  try {
    await guild.roles.fetch();
    if (isSnowflake(idOrName)) return guild.roles.cache.get(idOrName) || await guild.roles.fetch(idOrName).catch(() => null);
    return guild.roles.cache.find(r => r.name === idOrName) || null;
  } catch { return null; }
}
async function resolveAllGroupRoles(guild) {
  const entries = [];
  for (const [bucket, idOrName] of Object.entries(ROLE_BUCKETS)) {
    const role = await resolveRole(guild, idOrName);
    if (role) entries.push({ bucket, role });
  }
  return entries;
}
function firstLetterAZ(username) { if (!username) return null; const m = username.toLowerCase().match(/[a-z]/); return m ? m[0] : null; }
function letterToBucket(letter) {
  if (!letter) return null;
  if (letter >= 'a' && letter <= 'e') return 'AE';
  if (letter <= 'j') return 'FJ';
  if (letter <= 'o') return 'KO';
  if (letter <= 't') return 'PT';
  if (letter <= 'z') return 'UZ';
  return null;
}
async function hasVerified(member) {
  const verifiedRole = await resolveRole(member.guild, VERIFIED_ROLE_ID_OR_NAME);
  if (!verifiedRole) { warn(`[${member.guild.name}] Verified role not found. Create it or set VERIFIED_ROLE_ID in .env`); return false; }
  return member.roles.cache.has(verifiedRole.id);
}

async function assignBucketIfVerified(member, reason = 'Bucket assignment') {
  try {
    if (!await hasVerified(member)) return false;
    const uname = member.user?.username || member.displayName;
    const bucket = letterToBucket(firstLetterAZ(uname));
    if (!bucket) return false;

    const targetRole = await resolveRole(member.guild, ROLE_BUCKETS[bucket]);
    if (!targetRole) { warn(`[${member.guild.name}] Target role for ${bucket} not found. Create it or set ROLE_${bucket}_ID in .env`); return false; }

    const allGroup = await resolveAllGroupRoles(member.guild);
    const rolesToRemove = allGroup.filter(({ bucket: b, role }) => role && b !== bucket && member.roles.cache.has(role.id)).map(({ role }) => role.id);
    if (rolesToRemove.length) await member.roles.remove(rolesToRemove, `${reason} (cleanup other buckets)`).catch(console.warn);

    if (!member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole, `${reason} (${bucket})`).catch(console.warn);
      info(`[${member.guild.name}] Assigned ${targetRole.name} to ${member.user.tag} (${uname})`);
      return true;
    }
    return false;
  } catch (e) { warn(`assignBucketIfVerified error for ${member.user?.tag}: ${e.message}`); return false; }
}

function setupRoleBuckets(client) {
  client.once(Events.ClientReady, async () => {
    for (const [, guild] of client.guilds.cache) {
      try {
        info(`[${guild.name}] Startup sweep…`);
        await guild.roles.fetch(); await guild.members.fetch();
        let checked = 0, changed = 0;
        for (const member of guild.members.cache.values()) { checked++; if (await assignBucketIfVerified(member, 'Startup sweep')) changed++; }
        info(`[${guild.name}] Sweep complete. Checked ${checked}, updated ${changed}.`);
      } catch (e) { warn(`[${guild.name}] Sweep failed: ${e.message}`); }
    }
  });
  client.on(Events.GuildMemberAdd, async (m) => { await assignBucketIfVerified(m, 'Member joined'); });
  client.on(Events.GuildMemberUpdate, async (_o, n) => { await assignBucketIfVerified(n, 'Member updated'); });
  client.on(Events.UserUpdate, async (oldUser, newUser) => {
    if (oldUser.username === newUser.username) return;
    for (const [, guild] of client.guilds.cache) {
      const member = await guild.members.fetch(newUser.id).catch(() => null);
      if (member) await assignBucketIfVerified(member, 'Username changed');
    }
  });
}

module.exports = { setupRoleBuckets };