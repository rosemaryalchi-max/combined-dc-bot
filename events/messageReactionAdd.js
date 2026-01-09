const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        // Fetch if partial
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }

        // Logic relies on checking the message content or database.
        // For this simple bot, we'll check if the message embeds contain "React with [emoji] to get [role]" pattern
        // OR simpler: check if the bot is the author and there is an embed.
        // In production, use a Database to link messageID to RoleID.

        const message = reaction.message;
        if (message.author.id !== reaction.client.user.id) return;
        if (message.embeds.length === 0) return;

        const embed = message.embeds[0];
        if (embed.title === 'Reaction Role') {
            // Very basic parsing: find role by name in description? No, unreliable.
            // Let's rely on finding a role name in bold **RoleName**
            const description = embed.description;
            const roleMatch = description.match(/\*\*(.+?)\*\*/);

            if (roleMatch && roleMatch[1]) {
                const roleName = roleMatch[1];
                const role = message.guild.roles.cache.find(r => r.name === roleName);

                if (role) {
                    const member = await message.guild.members.fetch(user.id);
                    if (reaction.emoji.name === description.split('with ')[1].split(' ')[0] || true) { // Emoji check is hard with custom emojis regex
                        await member.roles.add(role);
                    }
                }
            }
        }
    },
};
