const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            const channel = member.guild.channels.cache.find(ch => ch.name === 'general' || ch.name === 'welcome');
            if (channel) {
                const embed = new EmbedBuilder()
                    .setDescription(`${member.user.tag} has left the server.`)
                    .setColor('DarkGrey')
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        } catch (e) {
            console.error('Goodbye message error:', e);
        }
    },
};
