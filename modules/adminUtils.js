const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const adminCommands = [
  new SlashCommandBuilder().setName('ping').setDescription('Show bot latency.'),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show user info.')
    .addUserOption((o) => o.setName('user').setDescription('User')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show server info.'),
].map((c) => c.toJSON());

function embed(title, fields) {
  const e = new EmbedBuilder().setTitle(title).setTimestamp(new Date());
  if (fields?.length) e.addFields(fields);
  return e;
}

async function handleInteractionAdmin(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  const name = interaction.commandName;
  if (!['ping', 'userinfo', 'serverinfo'].includes(name)) return false;

  if (name === 'ping') {
    const wsPing = interaction.client.ws.ping;
    const now = Date.now();
    await interaction.reply({ content: 'Pinging...', ephemeral: true });
    const msg = `Pong. WS: ${wsPing}ms | RTT: ${Date.now() - now}ms`;
    await interaction.editReply({ content: msg });
    return true;
  }

  if (name === 'userinfo') {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
    const fields = [
      { name: 'User', value: `${user.tag} (${user.id})` },
      { name: 'Created', value: user.createdAt.toISOString() },
    ];
    if (member) {
      fields.push({ name: 'Joined', value: member.joinedAt ? member.joinedAt.toISOString() : 'unknown' });
      fields.push({ name: 'Roles', value: String(member.roles.cache.size) });
    }
    await interaction.reply({ embeds: [embed('User Info', fields)], ephemeral: true });
    return true;
  }

  if (name === 'serverinfo') {
    const g = interaction.guild;
    if (!g) { await interaction.reply({ content: 'No guild context.', ephemeral: true }); return true; }
    const fields = [
      { name: 'Name', value: `${g.name} (${g.id})` },
      { name: 'Members', value: String(g.memberCount || 0) },
      { name: 'Created', value: g.createdAt.toISOString() },
    ];
    await interaction.reply({ embeds: [embed('Server Info', fields)], ephemeral: true });
    return true;
  }

  return false;
}

module.exports = { adminCommands, handleInteractionAdmin };
