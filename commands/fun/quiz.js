const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const https = require('https');
const { addQuizPoints } = require('../../utils/stats');

function fetchQuestion() {
    return new Promise((resolve, reject) => {
        https.get('https://opentdb.com/api.php?amount=1&type=multiple', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.results && json.results.length > 0) resolve(json.results[0]);
                    else reject(new Error('No questions found'));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Utility to decode HTML entities (e.g. &quot;)
function decodeHtml(html) {
    if (!html) return '';
    return html
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

// Shuffle array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Play a trivia quiz to earn points!'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const q = await fetchQuestion();
            const correct = decodeHtml(q.correct_answer);
            const answers = q.incorrect_answers.map(a => decodeHtml(a));
            answers.push(correct);
            shuffle(answers);

            const embed = new EmbedBuilder()
                .setTitle(`🧠 Trivia Time: ${q.category}`)
                .setDescription(`**${decodeHtml(q.question)}**`)
                .setColor('Blue')
                .addFields({ name: 'Difficulty', value: q.difficulty, inline: true });

            const rows = [];
            const row1 = new ActionRowBuilder();
            const row2 = new ActionRowBuilder();

            answers.forEach((ans, i) => {
                const btn = new ButtonBuilder()
                    .setCustomId(`quiz_${i}`)
                    .setLabel(ans.length > 80 ? ans.substring(0, 77) + '...' : ans) // Discord limit
                    .setStyle(ButtonStyle.Secondary);

                if (i < 2) row1.addComponents(btn);
                else row2.addComponents(btn);
            });

            rows.push(row1);
            if (answers.length > 2) rows.push(row2);

            const msg = await interaction.editReply({ embeds: [embed], components: rows });

            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: 'Start your own quiz!', ephemeral: true });

                const chosen = answers[parseInt(i.customId.split('_')[1])];
                const isCorrect = chosen === correct;

                // Disable all buttons and color them
                rows.forEach(r => {
                    r.components.forEach(b => {
                        const index = parseInt(b.data.custom_id.split('_')[1]);
                        const ans = answers[index];
                        b.setDisabled(true);
                        if (ans === correct) b.setStyle(ButtonStyle.Success);
                        else if (ans === chosen && !isCorrect) b.setStyle(ButtonStyle.Danger);
                    });
                });

                if (isCorrect) {
                    addQuizPoints(interaction.guildId, interaction.user.id, 10);
                    await i.update({ content: '✅ **Correct!** (+10 Points)', components: rows });
                } else {
                    await i.update({ content: `❌ **Wrong!** The correct answer was **${correct}**.`, components: rows });
                }
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ content: '⏰ Time is up!', components: [] });
                }
            });

        } catch (e) {
            console.error(e);
            interaction.editReply('❌ Failed to fetch question. Try again later.');
        }
    },
};
