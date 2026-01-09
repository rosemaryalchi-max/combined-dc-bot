const { REST, Routes } = require('discord.js');
const { ok, warn } = require('../utils/logger');

async function registerAllSlashCommands(client, commands, { token, global, guildIds }) {
  const rest = new REST({ version: '10' }).setToken(token);
  const app = await client.application.fetch();

  if (global) {
    await rest.put(Routes.applicationCommands(app.id), { body: commands });
    ok(`Global slash commands registered for app ${app.id}. (Propagation may take up to 1 hour)`);
    return;
  }

  if (guildIds?.length) {
    for (const gid of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(app.id, gid), { body: commands });
        ok(`Slash commands registered for guild ${gid} (app ${app.id}).`);
      } catch (e) {
        warn(`Failed to register commands for guild ${gid}: ${e?.message || e}`);
      }
    }
  } else {
    warn('No GUILD_IDS provided and GLOBAL_COMMANDS=false - skipping registration.');
  }
}

module.exports = { registerAllSlashCommands };
