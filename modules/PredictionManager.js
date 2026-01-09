const { EmbedBuilder } = require('discord.js');
const { getPrice } = require('../utils/crypto');

// Map<channelId, GameObject>
const activeGames = new Map();

/**
 * Starts a prediction game in a channel.
 */
async function startGame(interaction, coin, minutes) {
    const channelId = interaction.channelId;

    if (activeGames.has(channelId)) {
        return interaction.editReply('❌ There is already a game running in this channel!');
    }

    try {
        const { price: startPrice, name, symbol, image } = await getPrice(coin);
        const endTime = Date.now() + (minutes * 60 * 1000);

        const game = {
            coin,
            name,
            symbol,
            image, // Store image to reuse in end embed
            startPrice,
            endTime,
            guesses: [], // { userId, amount, username }
            interaction // Store interaction to send follow-ups? Or just send to channel.
        };

        activeGames.set(channelId, game);

        const embed = new EmbedBuilder()
            .setTitle(`🔮 Prediction Game: ${name} (${symbol})`)
            .setDescription(`**Guess the price of ${name} in ${minutes} minutes!**\n\nCurrent Price: **$${startPrice.toLocaleString()}**\n\nUse \`/predict <amount>\` to place your guess!\nTime ends <t:${Math.floor(endTime / 1000)}:R>.`)
            .setThumbnail(image)
            .setColor('Purple');

        await interaction.editReply({ embeds: [embed] });

        // Set timer
        setTimeout(() => endGame(channelId, interaction.client), minutes * 60 * 1000);

    } catch (e) {
        await interaction.editReply(`❌ Could not start game: ${e.message}`);
    }
}

/**
 * Records a user's guess.
 */
function addGuess(channelId, user, amount) {
    const game = activeGames.get(channelId);
    if (!game) return 'No active game in this channel.';

    // Check if user already guessed
    if (game.guesses.find(g => g.userId === user.id)) {
        return 'You have already guessed!';
    }

    game.guesses.push({ userId: user.id, username: user.username, amount });
    return `✅ Guess recorded: **$${amount}**`;
}

/**
 * Ends the game and announces winner.
 */
async function endGame(channelId, client) {
    const game = activeGames.get(channelId);
    if (!game) return;

    activeGames.delete(channelId); // Remove from active

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const { price: endPrice } = await getPrice(game.coin);

        const embed = new EmbedBuilder()
            .setTitle(`🏁 Game Over: ${game.name} (${game.symbol})`)
            .setThumbnail(game.image)
            .setColor('Gold')
            .addFields(
                { name: 'Start Price', value: `$${game.startPrice.toLocaleString()}`, inline: true },
                { name: 'End Price', value: `$${endPrice.toLocaleString()}`, inline: true },
                { name: 'Change', value: `${((endPrice - game.startPrice) / game.startPrice * 100).toFixed(2)}%`, inline: true }
            );

        if (game.guesses.length === 0) {
            embed.setDescription('No one guessed! 😢');
        } else {
            // Find winner (closest guess)
            game.guesses.sort((a, b) => Math.abs(a.amount - endPrice) - Math.abs(b.amount - endPrice));

            const winner = game.guesses[0];
            const diff = Math.abs(winner.amount - endPrice);

            embed.setDescription(`🎉 **Winner:** <@${winner.userId}>\nGuess: **$${winner.amount}** (Diff: $${diff.toLocaleString()})`);

            // Track Stats
            const { addPredictionWin } = require('../utils/stats');
            addPredictionWin(channelId, winner.userId, 0); // 0 earnings for now, just counting wins

            // Top 3
            let leaderboard = game.guesses.slice(0, 3).map((g, i) =>
                `${i + 1}. **${g.username}**: $${g.amount} (Diff: $${Math.abs(g.amount - endPrice).toFixed(2)})`
            ).join('\n');

            embed.addFields({ name: 'Leaderboard', value: leaderboard });
        }

        await channel.send({ embeds: [embed] });

    } catch (e) {
        console.error('End Game Error:', e);
    }
}

module.exports = { startGame, addGuess, activeGames };
