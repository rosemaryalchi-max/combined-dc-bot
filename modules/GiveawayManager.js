const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const STATE_FILE = path.join(__dirname, '..', 'giveaways.json');

class GiveawayManager {
    constructor() {
        this.giveaways = [];
        this.loadState();
        this.checkInterval = setInterval(() => this.checkGiveaways(), 5000);
    }

    loadState() {
        try {
            this.giveaways = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch {
            this.giveaways = [];
        }
    }

    saveState() {
        fs.writeFileSync(STATE_FILE, JSON.stringify(this.giveaways, null, 2));
    }

    async start(interaction, durationMs, prize, winnerCount) {
        const endTime = Date.now() + durationMs;

        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize**: ${prize}\n**Ends**: <t:${Math.floor(endTime / 1000)}:R>\n**Winners**: ${winnerCount}\n\nReact with 🎉 to enter!`)
            .setColor(0xFF0000)
            .setTimestamp(endTime);

        const message = await interaction.channel.send({ embeds: [embed] });
        await message.react('🎉');

        const giveaway = {
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            prize,
            winnerCount,
            endTime,
            ended: false,
            hostId: interaction.user.id
        };

        this.giveaways.push(giveaway);
        this.saveState();
        return giveaway;
    }

    async end(giveaway) {
        if (giveaway.ended) return;
        giveaway.ended = true;
        this.saveState();

        // Fetch message
        // We need the client, but manager is singleton. We can pass client or use a global ref if we had one.
        // Better: Pass client in constructor or setClient method?
        // For now, let's assume checkGiveaways has access to client via some method or we pass it.
        // Actually, simple solution: We need a way to get the client.
        // Let's rely on the caller to handle pure logic or pass client to checkGiveaways?
        // Wait, standard singleton pattern with client injection is best.
    }

    setClient(client) {
        this.client = client;
    }

    async checkGiveaways() {
        if (!this.client) return;

        const now = Date.now();
        for (const g of this.giveaways) {
            if (!g.ended && g.endTime <= now) {
                await this.finishGiveaway(g);
            }
        }
    }

    async finishGiveaway(g) {
        g.ended = true;
        this.saveState();

        try {
            const channel = await this.client.channels.fetch(g.channelId);
            if (!channel) return;
            const message = await channel.messages.fetch(g.messageId);
            if (!message) return;

            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) return channel.send('Giveaway ended, but no reactions found!');

            const users = await reaction.users.fetch();
            const validUsers = users.filter(u => !u.bot).map(u => u.id);

            if (validUsers.length === 0) {
                return message.reply('Giveaway ended, but no one entered!');
            }

            const winners = [];
            for (let i = 0; i < g.winnerCount; i++) {
                if (validUsers.length === 0) break;
                const index = Math.floor(Math.random() * validUsers.length);
                winners.push(validUsers.splice(index, 1)[0]);
            }

            const winnerString = winners.map(id => `<@${id}>`).join(', ');

            const endEmbed = EmbedBuilder.from(message.embeds[0])
                .setColor(0x000000)
                .setDescription(`**Prize**: ${g.prize}\n**Ended**: <t:${Math.floor(g.endTime / 1000)}:R>\n**Winners**: ${winnerString}`);

            await message.edit({ embeds: [endEmbed] });
            await message.reply(`🎉 Congratulations ${winnerString}! You won **${g.prize}**!`);

        } catch (e) {
            console.error(`Failed to finish giveaway ${g.messageId}:`, e);
        }
    }

    async reroll(interaction, messageId) {
        const g = this.giveaways.find(x => x.messageId === messageId);
        if (!g) return 'Giveaway not found.';

        // Reroll logic logic is same as finish but triggered manually
        await this.finishGiveaway({ ...g, ended: false }); // Force re-run logic
        return 'Rerolled!';
    }
}

module.exports = new GiveawayManager();
