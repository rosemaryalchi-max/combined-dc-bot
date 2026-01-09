const { REST, Routes } = require('discord.js');
const { clientId, token, GUILD_IDS } = require('./config');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

const getFilesRecursively = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    });
    return results;
};

const commandFiles = getFilesRecursively(commandsPath);

for (const filePath of commandFiles) {
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // If GUILD_ID is present, deploy to guild (faster for dev), else global
        if (GUILD_IDS.length > 0) {
            console.log(`Deploying to ${GUILD_IDS.length} guild(s)...`);
            for (const id of GUILD_IDS) {
                try {
                    console.log(`Deploying to ${id}...`);
                    await rest.put(
                        Routes.applicationGuildCommands(clientId, id),
                        { body: commands },
                    );
                    console.log(`✅ Deployed to ${id}`);
                } catch (e) {
                    console.error(`❌ Failed to deploy to ${id}:`, e.message);
                }
            }
        } else {
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
        }

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
