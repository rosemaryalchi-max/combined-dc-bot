const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (user.bot) return;

        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }

        const message = reaction.message;
        if (message.author.id !== reaction.client.user.id) return;
        if (message.embeds.length === 0) return;

        const embed = message.embeds[0];
        if (embed.title === 'Reaction Role') {
            const description = embed.description;
            const roleMatch = description.match(/\*\*(.+?)\*\*/);

            if (roleMatch && roleMatch[1]) {
                const roleName = roleMatch[1];
                const role = message.guild.roles.cache.find(r => r.name === roleName);

                if (role) {
                    const member = await message.guild.members.fetch(user.id);
                    await member.roles.remove(role);
                }
            }
        }
    },
};
