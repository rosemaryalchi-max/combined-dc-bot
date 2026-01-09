const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getUserRank } = require('../../utils/mee6');
const Canvas = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Check your MEE6 level and rank.')
        .addUserOption(option =>
            option.setName('user').setDescription('The user to check')),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user') || interaction.user;

        // Fetch Data
        const data = await getUserRank(interaction.guild.id, target.id);

        if (!data) {
            return interaction.editReply(`Could not find rank for ${target} (maybe not in top 500 or MEE6 is private/disabled).`);
        }

        // Generate Card
        const width = 800;
        const height = 250;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (Gradient)
        // Using a sleek dark theme
        const grd = ctx.createLinearGradient(0, 0, width, height);
        grd.addColorStop(0, '#232526');
        grd.addColorStop(1, '#414345');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, width, height);

        // Avatar Circle
        const avatarSize = 160;
        const avatarX = 50;
        const avatarY = (height - avatarSize) / 2;

        try {
            const avatarURL = target.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarURL);

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // Border
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        } catch (e) { }

        // Text Info
        ctx.fillStyle = '#ffffff';

        // Username
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(target.username, 240, 80);

        // Rank & Level
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(`Rank #${data.rank}`, 240, 120);
        ctx.fillText(`Level ${data.level}`, 400, 120);

        // XP Info
        const xpRequired = 5 * (data.level ** 2) + 50 * data.level + 100; // MEE6 formula approximation (often needs actual total XP calc)
        // MEE6 API gives detailed XP Usually: { level_xp, detailed_xp: [current, total_for_level] }
        // Let's use what data we have. data.xp might be total XP. 
        // data.detailed_xp usually has distinct values.
        // For safety, we just show "Total XP".

        ctx.fillText(`XP: ${data.xp.toLocaleString()}`, 240, 150);

        // Progress Bar (Mockup based on level progress if available, otherwise simplified)
        // If data.detailed_xp exists:
        // [ current_xp_in_level, required_xp_for_next_level ]
        let pct = 0;
        if (data.detailed_xp && data.detailed_xp.length === 2) {
            pct = data.detailed_xp[0] / data.detailed_xp[1];
        }

        const barX = 240;
        const barY = 180;
        const barW = 500;
        const barH = 20;

        // Bg Bar
        ctx.fillStyle = '#444444';
        ctx.fillRect(barX, barY, barW, barH); // Rounded rect omitted for speed

        // Fill Bar
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(barX, barY, barW * pct, barH);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });
        await interaction.editReply({ files: [attachment] });
    }
};
