const { Events } = require('discord.js');
const musicManager = require('../modules/MusicManager');

module.exports = {
    name: Events.VoiceStateUpdate,
    execute(oldState, newState) {
        musicManager.handleVoiceStateUpdate(oldState, newState);
    },
};
