const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const { updateGuildConfig, getGuildConfig } = require('../utils/guildConfig');
const { ok } = require('../utils/logger');

// Categories for the main menu
const CATEGORIES = {
    overview: { label: 'Overview', description: 'View current configuration', emoji: '🏠' },
    channels: { label: 'Channels', description: 'Configure specific channels', emoji: '📺' },
    security: { label: 'Security', description: 'Logs and Panic Mode', emoji: '🛡️' },
    music: { label: 'Music', description: 'Music channel and Idle timer', emoji: '🎵' },
    ticket: { label: 'Tickets', description: 'Support Ticket System', emoji: '📩' },
    tools: { label: 'Tools', description: 'Create Panels (Verify, Tickets)', emoji: '🛠️' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Initialize the Admin Configuration Channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const channelName = 'admin-config';

        // 1. Check if channel exists
        let adminChannel = guild.channels.cache.find(c => c.name === channelName);

        if (!adminChannel) {
            try {
                // Create private channel
                adminChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        // Allow Admin roles? For now just the creator or admins
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] }
                        // Note: Administrators bypass ViewChannel deny, so they will see it.
                    ]
                });
            } catch (e) {
                return interaction.editReply(`❌ Failed to create #${channelName}: ${e.message}`);
            }
        }

        // 2. Send Control Panel
        await sendControlPanel(adminChannel, guild.id);

        await interaction.editReply(`✅ Admin configuration opened in ${adminChannel}`);
    },

    // Export handler for interactionCreate.js
    async handleSetupInteraction(interaction) {
        const { customId, guildId } = interaction;

        // Handle Main Menu Navigation
        if (customId === 'setup_category_select') {
            const selected = interaction.values[0];
            await updatePanel(interaction, selected);
        }

        // Handle Back Button
        else if (customId === 'setup_home') {
            await updatePanel(interaction, 'overview');
        }

        // --- SUB-HANDLERS ---
        else if (customId.startsWith('setup_config_')) {
            await handleConfigAction(interaction);
        }
    }
};

// --- HELPER FUNCTIONS ---

async function sendControlPanel(channel, guildId) {
    // Clear old messages? Ideally.
    // For simplicity, just send a new one.
    const embed = getEmbed('overview', guildId);
    const rows = getComponents('overview');
    await channel.send({ embeds: [embed], components: rows });
}

async function updatePanel(interaction, category) {
    const embed = getEmbed(category, interaction.guildId);
    const rows = getComponents(category);
    await interaction.update({ embeds: [embed], components: rows });
}

function getEmbed(category, guildId) {
    const config = getGuildConfig(guildId);
    const embed = new EmbedBuilder().setColor('Blurple').setTimestamp();

    switch (category) {
        case 'overview':
            embed.setTitle('⚙️ Admin Control Panel')
                .setDescription('Select a category from the dropdown below to configure the bot.')
                .addFields(
                    { name: '📝 Logs', value: config.logChannelId ? `<#${config.logChannelId}>` : '❌ Not Set', inline: true },
                    { name: '🎵 Music', value: config.music?.channelId ? `<#${config.music.channelId}>` : '✅ Any Voice', inline: true },
                    { name: '🛡️ Panic', value: config.panic?.enabled ? '✅ Enabled' : '❌ Disabled', inline: true }
                );
            break;

        case 'channels':
            embed.setTitle('📺 Channel Configuration')
                .setDescription('Select channels for specific features below.')
                .addFields(
                    { name: 'Welcome Channel', value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : 'Not Set', inline: true },
                    { name: 'Faucet Channel', value: config.faucetChannelId ? `<#${config.faucetChannelId}>` : 'Not Set', inline: true }
                );
            break;

        case 'security':
            embed.setTitle('🛡️ Security Settings')
                .setDescription('Configure moderation logs and panic mode.')
                .addFields(
                    { name: 'Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not Set', inline: true },
                    { name: 'Panic Mode', value: config.panic?.enabled ? 'Enabled' : 'Disabled', inline: true }
                );
            break;

        case 'music':
            embed.setTitle('🎵 Music Settings')
                .setDescription('Configure music restrictions.')
                .addFields(
                    { name: 'Music Channel', value: config.music?.channelId ? `<#${config.music.channelId}>` : 'Any Voice Channel', inline: true },
                    { name: 'Idle Timer', value: `${config.music?.idleMinutes || 0.5} mins`, inline: true }
                );
            break;

        case 'ticket':
            embed.setTitle('📩 Ticket System')
                .setDescription('Configure support tickets.')
                .addFields(
                    { name: 'Support Role', value: config.ticket?.supportRoleId ? `<@&${config.ticket.supportRoleId}>` : 'Not Set', inline: true },
                    { name: 'Ticket Category', value: config.ticket?.categoryOpenId ? `<#${config.ticket.categoryOpenId}>` : 'Not Set', inline: true }
                );
            break;

        case 'tools':
            embed.setTitle('🛠️ Admin Tools')
                .setDescription('Use the buttons below to create interactive panels in the CURRENT channel (make sure you run this command where you want the panel, wait actually this is a persistent menu). \n\n**To create panels:** select the target channel below.');
            break;
    }
    return embed;
}

function getComponents(category) {
    // 1. Main Navigation Dropdown (Always present or at top?)
    // Let's put it at the bottom for persistent nav.

    const navRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('setup_category_select')
            .setPlaceholder('Select a Category...')
            .addOptions(Object.keys(CATEGORIES).map(key => ({
                label: CATEGORIES[key].label,
                description: CATEGORIES[key].description,
                value: key,
                emoji: CATEGORIES[key].emoji,
                default: key === category
            })))
    );

    const rows = [];

    // 2. Specific Controls based on Category
    if (category === 'channels') {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_welcome_channel')
                    .setPlaceholder('Select Welcome Channel')
                    .setChannelTypes(ChannelType.GuildText)
            ),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_faucet_channel')
                    .setPlaceholder('Select Faucet Channel')
                    .setChannelTypes(ChannelType.GuildText)
            )
        );
    }

    else if (category === 'security') {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_log_channel')
                    .setPlaceholder('Select Log Channel')
                    .setChannelTypes(ChannelType.GuildText)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_config_toggle_panic').setLabel('Toggle Panic Mode').setStyle(ButtonStyle.Danger)
            )
        );
    }

    else if (category === 'music') {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_music_channel')
                    .setPlaceholder('Select Music Channel (Voice Only)')
                    .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_config_clear_music').setLabel('Reset to Any Voice Channel').setStyle(ButtonStyle.Secondary)
            )
        );
    }

    else if (category === 'tools') {
        rows.push(
            // Need a target channel selector first?
            // This is getting complex for a simple menu.
            // Let's simplify: "Create Ticket Panel in THIS channel" might be weird if "THIS" is #admin-config.
            // So we need a channel selector.
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_tool_target')
                    .setPlaceholder('Select Target Channel for Panel')
                    .setChannelTypes(ChannelType.GuildText)
            ),
            // We need to know which tool to spawn. maybe buttons?
            // Logic: Select channel first, THEN click button? Interaction state is hard.
            // Alternative: "Create Ticket Panel in..." -> Select Menu immediately spawns it? Yes.
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_spawn_ticket')
                    .setPlaceholder('🚀 Spawn Ticket Panel in...')
                    .setChannelTypes(ChannelType.GuildText)
            ),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_config_spawn_verify')
                    .setPlaceholder('🚀 Spawn Verification Panel in...')
                    .setChannelTypes(ChannelType.GuildText)
            )
        );
    }

    rows.push(navRow);
    return rows;
}

async function handleConfigAction(interaction) {
    const { customId, guildId, values } = interaction;
    const config = getGuildConfig(guildId);

    // --- Channels ---
    if (customId === 'setup_config_welcome_channel') {
        updateGuildConfig(guildId, c => { c.welcomeChannelId = values[0]; return c; });
        await interaction.reply({ content: `✅ Welcome channel set to <#${values[0]}>`, ephemeral: true });
    }
    else if (customId === 'setup_config_faucet_channel') {
        updateGuildConfig(guildId, c => { c.faucetChannelId = values[0]; return c; });
        await interaction.reply({ content: `✅ Faucet channel set to <#${values[0]}>`, ephemeral: true });
    }

    // --- Security ---
    else if (customId === 'setup_config_log_channel') {
        updateGuildConfig(guildId, c => { c.logChannelId = values[0]; return c; });
        await interaction.reply({ content: `✅ Log channel set to <#${values[0]}>`, ephemeral: true });
    }
    else if (customId === 'setup_config_toggle_panic') {
        const newState = !config.panic?.enabled;
        updateGuildConfig(guildId, c => { if (!c.panic) c.panic = {}; c.panic.enabled = newState; return c; });
        // Refresh panel
        await updatePanel(interaction, 'security');
    }

    // --- Music ---
    else if (customId === 'setup_config_music_channel') {
        updateGuildConfig(guildId, c => {
            if (!c.music) c.music = {};
            c.music.channelId = values[0];
            c.musicChannelId = values[0];
            return c;
        });
        await interaction.reply({ content: `✅ Music restricted to <#${values[0]}>`, ephemeral: true });
        // Optional: Update panel to show change
    }
    else if (customId === 'setup_config_clear_music') {
        updateGuildConfig(guildId, c => {
            if (!c.music) c.music = {};
            c.music.channelId = null;
            c.musicChannelId = null;
            return c;
        });
        await updatePanel(interaction, 'music');
    }

    // --- Tools ---
    else if (customId === 'setup_config_spawn_ticket') {
        const targetChannel = interaction.guild.channels.cache.get(values[0]);
        if (!targetChannel) return;

        const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
        const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('Open Ticket').setEmoji('📩').setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(btn);
        const embed = new EmbedBuilder().setColor('Blue').setTitle('Support Tickets').setDescription('Click below to open a ticket.');

        await targetChannel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Ticket panel created in ${targetChannel}`, ephemeral: true });
    }
    // For Verification, we need a Role too.
    // This is hard to do with just one Select Menu. 
    // Maybe we just ask for role via a Modal? Or rely on default "Verified" role from config?
    // Let's use config.VERIFIED_ROLE_ID.
    else if (customId === 'setup_config_spawn_verify') {
        const targetChannel = interaction.guild.channels.cache.get(values[0]);

        // Use hardcoded or config role ID
        const roleId = require('../config').VERIFIED_ROLE_ID_OR_NAME;
        // Note: If it's a name, we can't do much. Assume Setup has set it? 
        // Or just launch the button with a generic ID and handle it?
        // The button logic uses `verify_btn_${role.id}`.
        // Let's find the role named "Verified" or use Config.
        let role = interaction.guild.roles.cache.find(r => r.name === 'Verified' || r.id === roleId);

        if (!role) {
            return interaction.reply({ content: '❌ Could not find a "Verified" role. Please create one or check config.', ephemeral: true });
        }

        const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
        const btn = new ButtonBuilder().setCustomId(`verify_btn_${role.id}`).setLabel('Verify Me').setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder().addComponents(btn);
        const embed = new EmbedBuilder().setColor('Green').setTitle('Verification').setDescription('Click below to verify.');

        await targetChannel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Verification panel created in ${targetChannel}`, ephemeral: true });
    }
}
