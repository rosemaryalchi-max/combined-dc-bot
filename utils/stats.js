const fs = require('fs');
const path = require('path');

const STATS_PATH = path.join(__dirname, '..', 'data', 'stats.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(STATS_PATH))) {
    fs.mkdirSync(path.dirname(STATS_PATH), { recursive: true });
}

// Load stats or init empty
let stats = {};
if (fs.existsSync(STATS_PATH)) {
    try {
        stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    } catch (e) {
        console.error('Failed to load stats.json, starting fresh.', e);
    }
}

function saveStats() {
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

function getWeekNumber() {
    const d = new Date();
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Increment message count for a user. Resets if new week.
 */
function addMessage(guildId, userId) {
    if (!stats[guildId]) stats[guildId] = {};
    if (!stats[guildId][userId]) stats[guildId][userId] = { messages: { count: 0, week: getWeekNumber() }, predictions: { wins: 0, earnings: 0 } };

    const userStats = stats[guildId][userId];
    const currentWeek = getWeekNumber();

    if (userStats.messages.week !== currentWeek) {
        userStats.messages.count = 0;
        userStats.messages.week = currentWeek;
    }

    userStats.messages.count++;
    saveStats();
}

/**
 * Record a prediction win.
 */
function addPredictionWin(guildId, userId, earnings) {
    if (!stats[guildId]) stats[guildId] = {};
    if (!stats[guildId][userId]) stats[guildId][userId] = { messages: { count: 0, week: getWeekNumber() }, predictions: { wins: 0, earnings: 0 } };

    stats[guildId][userId].predictions.wins++;
    stats[guildId][userId].predictions.earnings += earnings; // earnings = diff? or arbitrary points? User didn't specify, assume 'amount' or virtual points.
    // Actually, in the game logic, 'earnings' implies profit? Or just "Won"? 
    // The user screenshot showed "0 prediction wins".
    // I'll just track wins for now.
    saveStats();
}

/**
 * Claim daily reward.
 * Returns object with status: 'success', 'cooldown', 'reset' and details.
 */
function claimDaily(guildId, userId) {
    if (!stats[guildId]) stats[guildId] = {};
    if (!stats[guildId][userId]) stats[guildId][userId] = {
        messages: { count: 0, week: getWeekNumber() },
        predictions: { wins: 0, earnings: 0 },
        daily: { streak: 0, lastClaim: 0 },
        quiz: { points: 0 }
    };

    // Ensure nested objects exist (migration safe)
    if (!stats[guildId][userId].daily) stats[guildId][userId].daily = { streak: 0, lastClaim: 0 };
    if (!stats[guildId][userId].quiz) stats[guildId][userId].quiz = { points: 0 };

    const userStats = stats[guildId][userId];
    const now = Date.now();
    const lastClaim = userStats.daily.lastClaim;
    const OneDay = 24 * 60 * 60 * 1000;

    // Cooldown check
    if (now - lastClaim < OneDay) {
        return { status: 'cooldown', remaining: OneDay - (now - lastClaim) };
    }

    // Streak logic
    let streak = userStats.daily.streak;
    // If more than 48 hours (2 days) passed, reset streak
    if (now - lastClaim > OneDay * 2 && lastClaim !== 0) {
        streak = 1; // Reset to 1 (current claim)
    } else {
        streak++;
    }

    userStats.daily.streak = streak;
    userStats.daily.lastClaim = now;
    saveStats();

    return { status: 'success', streak };
}

/**
 * Add points from quiz.
 */
function addQuizPoints(guildId, userId, points) {
    if (!stats[guildId]) stats[guildId] = {};
    if (!stats[guildId][userId]) stats[guildId][userId] = { messages: { count: 0, week: getWeekNumber() }, predictions: { wins: 0, earnings: 0 } };

    if (!stats[guildId][userId].quiz) stats[guildId][userId].quiz = { points: 0 };

    stats[guildId][userId].quiz.points += points;
    saveStats();
}

/**
 * Get stats for a user.
 */
function getStats(guildId, userId) {
    if (!stats[guildId] || !stats[guildId][userId]) {
        return {
            messages: { count: 0, week: getWeekNumber() },
            predictions: { wins: 0, earnings: 0 },
            daily: { streak: 0, lastClaim: 0 },
            quiz: { points: 0 }
        };
    }

    // Check week reset on read too
    const userStats = stats[guildId][userId];

    // Auto-migrate structure if missing
    if (!userStats.predictions) userStats.predictions = { wins: 0, earnings: 0 };
    if (!userStats.daily) userStats.daily = { streak: 0, lastClaim: 0 };
    if (!userStats.quiz) userStats.quiz = { points: 0 };

    if (userStats.messages.week !== getWeekNumber()) {
        userStats.messages.count = 0;
        userStats.messages.week = getWeekNumber();
        saveStats();
    }

    return userStats;
}

module.exports = { addMessage, addPredictionWin, claimDaily, addQuizPoints, getStats };
