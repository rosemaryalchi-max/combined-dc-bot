const https = require('https');

/**
 * Helper to make HTTPS requests with proper headers.
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://mee6.xyz/',
                'Origin': 'https://mee6.xyz'
            }
        };

        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                // Consume response data to free up memory
                res.resume();
                return reject(new Error(`MEE6 API Error: Status ${res.statusCode}`));
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Failed to parse MEE6 JSON response'));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Network Error: ${err.message}`));
        });
    });
}

/**
 * Fetches the public MEE6 leaderboard for a guild.
 * @param {string} guildId 
 * @returns {Promise<Object>} The leaderboard data (players, etc.)
 */
async function fetchLeaderboard(guildId) {
    return makeRequest(`https://mee6.xyz/api/plugins/levels/leaderboard/${guildId}`);
}

/**
 * Gets a specific user's rank from MEE6.
 * @param {string} guildId 
 * @param {string} userId 
 */
async function getUserRank(guildId, userId) {
    try {
        let page = 0;
        // Search first 5 pages (500 users)
        while (page < 5) {
            const data = await makeRequest(`https://mee6.xyz/api/plugins/levels/leaderboard/${guildId}?page=${page}`);

            if (!data.players || data.players.length === 0) break;

            const player = data.players.find(p => p.id === userId);
            if (player) {
                // MEE6 rank is index based
                const rank = (page * 100) + data.players.indexOf(player) + 1;
                return { ...player, rank };
            }
            page++;
        }
        return null;
    } catch (e) {
        console.error('MEE6 Fetch Error:', e.message);
        return null; // Graceful fallback
    }
}

module.exports = { fetchLeaderboard, getUserRank };
