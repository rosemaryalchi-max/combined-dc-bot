const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Auto-create security channel in all guilds
        const LOG_CHANNEL_NAME = 'security-logs';

        for (const guild of client.guilds.cache.values()) {
            const existingChannel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);

            if (!existingChannel) {
                try {
                    await guild.channels.create({
                        name: LOG_CHANNEL_NAME,
                        reason: 'Auto-creating security logging channel',
                        permissionOverwrites: [
                            {
                                id: guild.id, // @everyone
                                deny: ['ViewChannel'],
                            },
                            {
                                id: client.user.id, // Bot itself
                                allow: ['ViewChannel', 'SendMessages'],
                            }
                        ]
                    });
                    console.log(`Created ${LOG_CHANNEL_NAME} in guild: ${guild.name}`);
                } catch (error) {
                    console.error(`Failed to create log channel in ${guild.name}:`, error);
                }
            } else {
                console.log(`Log channel already exists in ${guild.name}`);
            }
        }
    },
};
