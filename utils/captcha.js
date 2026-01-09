const { createCanvas, registerFont } = require('canvas');
const path = require('path');

// Helper to generate a random range number
const random = (min, max) => Math.floor(Math.random() * (max - min) + 1) + min;

// Generate random alphanumeric text
function generateText(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let text = '';
    for (let i = 0; i < length; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}

async function createCaptcha() {
    const width = 400;
    const height = 150;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#23272a'; // Discord Darker
    ctx.fillRect(0, 0, width, height);

    // 2. Add Noise (Subtle Lines in background)
    for (let i = 0; i < 30; i++) {
        ctx.strokeStyle = `rgba(${random(100, 255)}, ${random(100, 255)}, ${random(100, 255)}, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(random(0, width), random(0, height));
        ctx.bezierCurveTo(random(0, width), random(0, height), random(0, width), random(0, height), random(0, width), random(0, height));
        ctx.lineWidth = random(1, 3);
        ctx.stroke();
    }

    // 3. Draw Text
    const text = generateText();
    const fontSize = 50;
    ctx.font = `bold ${fontSize}px Sans`;
    ctx.textBaseline = 'middle';

    // Calculate total width approx
    const charSpacing = 45;
    const startX = (width - (text.length * charSpacing)) / 2;

    for (let i = 0; i < text.length; i++) {
        ctx.save();
        // Position
        const x = startX + (i * charSpacing);
        const y = height / 2 + random(-5, 5); // Less vertical jitter

        ctx.translate(x, y);
        ctx.rotate(random(-0.2, 0.2)); // Less rotation for clarity

        // Bright contrasting colors
        ctx.fillStyle = `rgb(${random(200, 255)}, ${random(200, 255)}, ${random(200, 255)})`;
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
    }

    // 4. Add Noise (Dots on top, but sparse)
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(${random(200, 255)}, ${random(200, 255)}, ${random(200, 255)}, 0.5)`;
        ctx.beginPath();
        ctx.arc(random(0, width), random(0, height), random(1, 4), 0, Math.PI * 2);
        ctx.fill();
    }

    return {
        buffer: canvas.toBuffer(),
        answer: text
    };
}

module.exports = { createCaptcha };
