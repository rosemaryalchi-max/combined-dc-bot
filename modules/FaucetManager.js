const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const {
    BASE_RPC, SEPOLIA_RPC,
    USDT_ADDRESS_BASE,
    SENDER_PRIVATE_KEY_BASE,
    SENDER_PRIVATE_KEY_SEPOLIA,
    CLAIM_AMOUNT_USDT,
    TEST_ETH_AMOUNT
} = require('../config');
const { warn } = require('../utils/logger');
const { getGuildConfig } = require('../utils/guildConfig');

const STATE_FILE = path.join(__dirname, '..', 'giveaway_state.json');
const LOCK_FILE = `${STATE_FILE}.lock`;

class GiveawayManager {
    constructor() {
        this.provBase = new ethers.JsonRpcProvider(BASE_RPC);
        this.provSepo = new ethers.JsonRpcProvider(SEPOLIA_RPC);

        this.walletBase = SENDER_PRIVATE_KEY_BASE ? new ethers.Wallet(SENDER_PRIVATE_KEY_BASE, this.provBase) : null;
        this.walletSepo = SENDER_PRIVATE_KEY_SEPOLIA ? new ethers.Wallet(SENDER_PRIVATE_KEY_SEPOLIA, this.provSepo) : null;

        this.usdtBase = this.walletBase ? new ethers.Contract(
            USDT_ADDRESS_BASE,
            ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address account) view returns (uint256)', 'function decimals() view returns (uint8)'],
            this.walletBase
        ) : null;
    }

    loadState() {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch {
            return { base: { total: 0, users: {}, paused: false }, sepolia: { total: 0, users: {}, paused: false } };
        }
    }

    saveState(state) {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }

    async withLock(fn) {
        const start = Date.now();
        while (true) {
            try {
                const fd = fs.openSync(LOCK_FILE, 'wx');
                try { return await fn(); }
                finally { fs.closeSync(fd); fs.unlinkSync(LOCK_FILE); }
            } catch (e) {
                if (e.code !== 'EEXIST') throw e;
                if (Date.now() - start > 5000) throw new Error('Lock timeout');
                await new Promise(r => setTimeout(r, 100));
            }
        }
    }

    async claim(network, address, userId, guildId) {
        if (!ethers.isAddress(address)) throw new Error('Invalid address');

        // Config checks
        const config = getGuildConfig(guildId);
        // ... (Simplified checks, in real app apply whitelist/blacklist here)

        return await this.withLock(async () => {
            let state = this.loadState();
            let key = network === 'base-usdt' ? 'base' : 'sepolia';

            if (state[key].paused) throw new Error('Giveaway paused');

            // Check double claim
            if (state[key].users[userId]) throw new Error('Already claimed');

            let txHash;
            if (key === 'base') {
                if (!this.walletBase) throw new Error('Base wallet not configured');
                const amount = ethers.parseUnits(CLAIM_AMOUNT_USDT, 6); // Assuming 6 decimals for USDT
                const tx = await this.usdtBase.transfer(address, amount);
                await tx.wait();
                txHash = tx.hash;
            } else {
                if (!this.walletSepo) throw new Error('Sepolia wallet not configured');
                const amount = ethers.parseEther(TEST_ETH_AMOUNT);
                const tx = await this.walletSepo.sendTransaction({ to: address, value: amount });
                await tx.wait();
                txHash = tx.hash;
            }

            state[key].total++;
            state[key].users[userId] = { address, txHash, ts: Date.now() };
            this.saveState(state);

            return txHash;
        });
    }

    // Admin Helpers
    async setPaused(network, paused) {
        await this.withLock(async () => {
            const state = this.loadState();
            if (network === 'all' || network === 'base-usdt') state.base.paused = paused;
            if (network === 'all' || network === 'sepolia-eth') state.sepolia.paused = paused;
            this.saveState(state);
        });
    }

    async getBalances() {
        let baseEth = '0', baseUsdt = '0', sepoEth = '0';
        try {
            if (this.walletBase) {
                baseEth = ethers.formatEther(await this.provBase.getBalance(this.walletBase.address));
                if (this.usdtBase) {
                    baseUsdt = ethers.formatUnits(await this.usdtBase.balanceOf(this.walletBase.address), 6);
                }
            }
            if (this.walletSepo) {
                sepoEth = ethers.formatEther(await this.provSepo.getBalance(this.walletSepo.address));
            }
        } catch (e) {
            warn('Failed to fetch balances status: ' + e.message);
        }
        return { baseEth, baseUsdt, sepoEth };
    }
}

module.exports = new GiveawayManager();
