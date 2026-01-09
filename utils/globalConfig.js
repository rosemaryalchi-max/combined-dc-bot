const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'global_config.json');

function defaultGlobalConfig() {
    return {
        giveaway: {
            whitelist: [],
            blacklist: [],
        },
    };
}

function normalizeGlobalConfig(cfg) {
    return {
        giveaway: {
            whitelist: Array.isArray(cfg?.giveaway?.whitelist) ? cfg.giveaway.whitelist : [],
            blacklist: Array.isArray(cfg?.giveaway?.blacklist) ? cfg.giveaway.blacklist : [],
        },
    };
}

function loadGlobalConfig() {
    try { return normalizeGlobalConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
    catch { return defaultGlobalConfig(); }
}

function saveGlobalConfig(cfg) {
    const tmp = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
    fs.renameSync(tmp, CONFIG_FILE);
}

function updateGlobalConfig(updater) {
    const current = loadGlobalConfig();
    const next = updater(current) || current;
    saveGlobalConfig(next);
    return next;
}

module.exports = {
    loadGlobalConfig,
    updateGlobalConfig,
};
