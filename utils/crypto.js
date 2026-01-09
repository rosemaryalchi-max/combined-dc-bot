const https = require('https');

/**
 * Make a simple HTTPS GET request with headers.
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Status ${res.statusCode}`));
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Fetches price from CoinGecko (Symbol -> Search -> ID -> Price)
 */
async function getCoinGeckoPrice(symbol) {
    try {
        // 1. Search for ID
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
        const searchData = await makeRequest(searchUrl);

        if (!searchData.coins || searchData.coins.length === 0) {
            throw new Error(`Symbol ${symbol} not found on CoinGecko.`);
        }

        // Find exact match or take first
        const coin = searchData.coins.find(c => c.symbol.toUpperCase() === symbol.toUpperCase()) || searchData.coins[0];
        const id = coin.id;

        // 2. Fetch Price
        const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
        const priceData = await makeRequest(priceUrl);

        if (priceData[id] && priceData[id].usd) {
            return {
                price: parseFloat(priceData[id].usd),
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                image: coin.large || coin.thumb
            };
        }
        throw new Error('Price data missing');
    } catch (e) {
        throw e;
    }
}

/**
 * Fetches the current price of a cryptocurrency in USD.
 * @param {string} symbol - The coin symbol (e.g., BTC, ETH)
 * @returns {Promise<Object>} { price, name, symbol, image }
 */
async function getPrice(symbol) {
    // 1. Try CoinGecko (Use original casing for better search match)
    try {
        return await getCoinGeckoPrice(symbol);
    } catch (e) {
        console.error(`CoinGecko fetch failed for ${symbol}:`, e.message);
    }

    const s = symbol.toUpperCase(); // Uppercase for fallback/tickers

    // 2. Try CryptoCompare (Fallback)
    try {
        const url = `https://min-api.cryptocompare.com/data/price?fsym=${s}&tsyms=USD`;
        const data = await makeRequest(url);
        if (data.USD) {
            return {
                price: parseFloat(data.USD),
                name: s, // Fallback name
                symbol: s,
                image: `https://www.cryptocompare.com/media/19633/${s.toLowerCase()}.png` // Guessing icon path or null
            };
        }
    } catch (e) {
        console.error(`CryptoCompare fetch failed for ${s}:`, e.message);
    }

    throw new Error(`Could not find details for ${s}. Try a major coin like BTC, ETH, SOL.`);
}

module.exports = { getPrice };
