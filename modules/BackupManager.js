const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionsBitField } = require('discord.js');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

class BackupManager {

    getGuildBackupDir(guildId) {
        const dir = path.join(BACKUP_DIR, guildId);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        return dir;
    }

    async createBackup(guild) {
        const backup = {
            id: guild.id,
            name: guild.name,
            timestamp: Date.now(),
            roles: [],
            channels: []
        };

        // 1. Roles
        guild.roles.cache.sort((a, b) => b.position - a.position).forEach(role => {
            if (!role.managed) { // Skip bot managed roles
                backup.roles.push({
                    name: role.name,
                    color: role.hexColor,
                    permissions: role.permissions.bitfield.toString(),
                    hoist: role.hoist,
                    mentionable: role.mentionable,
                    position: role.position
                });
            }
        });

        // 2. Channels
        // We do a simple dump. Restoring accurately requires mapped IDs which we don't have yet.
        guild.channels.cache.sort((a, b) => a.position - b.position).forEach(channel => {
            backup.channels.push({
                name: channel.name,
                type: channel.type,
                parentId: channel.parentId, // Note: Parent IDs will be invalid on new server
                parentName: channel.parent ? channel.parent.name : null, // Better for restoring
                permissionOverwrites: Array.from(channel.permissionOverwrites.cache.values()).map(o => {
                    const role = guild.roles.cache.get(o.id);
                    return {
                        id: o.id, // Role/User ID
                        roleName: role ? role.name : null, // ID is useful if role exists, Name if not
                        allow: o.allow.bitfield.toString(),
                        deny: o.deny.bitfield.toString()
                    };
                })
            });
        });

        const filename = `${Date.now()}.json`;
        fs.writeFileSync(path.join(this.getGuildBackupDir(guild.id), filename), JSON.stringify(backup, null, 2));

        return filename;
    }

    listBackups(guildId) {
        const dir = this.getGuildBackupDir(guildId);
        return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
            const filePath = path.join(dir, f);
            const stats = fs.statSync(filePath);
            return {
                id: f.replace('.json', ''),
                timestamp: parseInt(f.replace('.json', '')),
                size: stats.size
            };
        }).sort((a, b) => b.timestamp - a.timestamp);
    }

    loadBackup(guildId, backupId) {
        const filePath = path.join(this.getGuildBackupDir(guildId), `${backupId}.json`);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
}

module.exports = new BackupManager();
