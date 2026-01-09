const Canvas = require('canvas');
const path = require('path');
const fs = require('fs');

// Register a font if available (optional)
// Canvas.registerFont('path/to/font.ttf', { family: 'Roboto' });

/**
 * Generate a Welcome Card
 * @param {GuildMember} member - The Discord member object
 * @param {string} theme - The theme name (gaming, anime, nature, abstract)
 * @param {string} title - Title text (e.g., "Welcome to {server}")
 * @param {string} text - Body text (e.g., "Hey {user}, nice to see you!")
 * @returns {Promise<Buffer>} - The image buffer
 */
async function generateWelcomeCard(member, theme = 'gaming', title = 'Welcome!', text = 'Hello!') {
    const width = 800;
    const height = 350;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    // You could load images here if you had them: await Canvas.loadImage(...)
    // For now, we use CSS-like gradients/colors based on theme
    switch (theme) {
        case 'gaming':
            const g1 = ctx.createLinearGradient(0, 0, width, height);
            g1.addColorStop(0, '#0f0c29');
            g1.addColorStop(0.5, '#302b63');
            g1.addColorStop(1, '#24243e');
            ctx.fillStyle = g1;
            break;
        case 'anime':
            const g2 = ctx.createLinearGradient(0, 0, width, height);
            g2.addColorStop(0, '#FF9A9E');
            g2.addColorStop(1, '#FECFEF');
            ctx.fillStyle = g2;
            break;
        case 'nature':
            const g3 = ctx.createLinearGradient(0, 0, width, height);
            g3.addColorStop(0, '#11998e');
            g3.addColorStop(1, '#38ef7d');
            ctx.fillStyle = g3;
            break;
        case 'abstract':
        default:
            const g4 = ctx.createLinearGradient(0, 0, width, height);
            g4.addColorStop(0, '#434343');
            g4.addColorStop(1, '#000000');
            ctx.fillStyle = g4;
            break;
    }
    ctx.fillRect(0, 0, width, height);

    // Add some noise or pattern (optional, simple circles for "design")
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = Math.random() * 20;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 2. Avatar (Middle Left)
    const avatarSize = 150;
    const avatarX = 75;
    const avatarY = (height - avatarSize) / 2;

    // Draw circle frame
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Clip and draw avatar
    try {
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await Canvas.loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        console.error('Failed to load avatar:', e);
        // Fallback circle
        ctx.fillStyle = '#cccccc';
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. Text
    const textX = 260; // Right of avatar
    const textWidth = width - textX - 40;

    // Process variables
    const cleanTitle = title
        .replace(/{server}/g, member.guild.name)
        .replace(/{user}/g, member.user.username);

    const cleanText = text
        .replace(/{server}/g, member.guild.name)
        .replace(/{user}/g, member.user.username)
        .replace(/{count}/g, member.guild.memberCount);

    // Title
    ctx.font = 'bold 50px sans-serif'; // Use system font
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cleanTitle, textX, height / 2 - 20, textWidth);

    // Subtitle
    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#dddddd';
    ctx.fillText(cleanText, textX, height / 2 + 30, textWidth);

    // 4. Return Buffer
    return canvas.toBuffer();
}

module.exports = { generateWelcomeCard };
