const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { updateGuildConfig, getGuildConfig } = require('../utils/guildConfig');
const { ok } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure all bot features and channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // --- VIEW CONFIG ---
        .addSubcommand(sub => sub.setName('view').setDescription('View current server configuration'))

        // --- CHANNEL CONFIGURATION ---
        .addSubcommandGroup(group =>
            group.setName('channels')
                .setDescription('Configure channels for specific features')
                .addSubcommand(sub =>
                    sub.setName('logs')
                        .setDescription('Set the Security/Mod Logs channel')
                        .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('welcome')
                        .setDescription('Set the Welcome message channel')
                        .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('music')
                        .setDescription('Restrict Music commands to a specific channel')
                        .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('faucet')
                        .setDescription('Restrict Faucet/Giveaway commands to a specific channel')
                        .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        )

        // --- ONE-TIME ACTIONS ---
        .addSubcommandGroup(group =>
            group.setName('create')
                .setDescription('Create panels and messages')
                .addSubcommand(sub =>
                    sub.setName('ticket_panel')
                        .setDescription('Create a Support Ticket panel in this channel'))
                .addSubcommand(sub =>
                    sub.setName('verification')
                        .setDescription('Create a Verification button in this channel')
                        .addRoleOption(o => o.setName('role').setDescription('Role to give when verified').setRequired(true)))
        ),

    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (!group && sub === 'view') {
            const config = getGuildConfig(guildId);
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Server Configuration')
                .setColor('Blue')
                .addFields(
                    { name: '📝 Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : '❌ Not Set', inline: true },
                    { name: '👋 Welcome Channel', value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '❌ Not Set (Default: general)', inline: true },
                    { name: '🎵 Music Channel', value: config.music?.channelId || config.musicChannelId ? `<#${config.music?.channelId || config.musicChannelId}>` : '✅ Any', inline: true },
                    { name: '💧 Faucet Channel', value: config.faucetChannelId ? `<#${config.faucetChannelId}>` : '✅ Any', inline: true }
                )
                .setFooter({ text: 'Use /setup channels [feature] [channel] to change.' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (group === 'channels') {
            const channel = interaction.options.getChannel('channel');

            if (sub === 'logs') {
                updateGuildConfig(guildId, c => { c.logChannelId = channel.id; return c; });
                await interaction.reply({ content: `✅ **Security Logs** will now be sent to ${channel}.`, ephemeral: true });
            }
            else if (sub === 'welcome') {
                updateGuildConfig(guildId, c => { c.welcomeChannelId = channel.id; return c; });
                await interaction.reply({ content: `✅ **Welcome Messages** will now be sent to ${channel}.`, ephemeral: true });
            }
            else if (sub === 'music') {
                updateGuildConfig(guildId, c => {
                    c.music.channelId = channel.id; // Legacy sync
                    c.musicChannelId = channel.id;
                    return c;
                });
                await interaction.reply({ content: `✅ **Music Commands** are now restricted to ${channel}.`, ephemeral: true });
            }
            else if (sub === 'faucet') {
                updateGuildConfig(guildId, c => { c.faucetChannelId = channel.id; return c; });
                await interaction.reply({ content: `✅ **Faucet Commands** are now restricted to ${channel}.`, ephemeral: true });
            }

            ok(`Coifg updated: ${sub} channel set to ${channel.name} (${channel.id}) for ${interaction.guild.name}`);
        }

        if (group === 'create') {
            if (sub === 'ticket_panel') {
                const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder: EB } = require('discord.js');
                const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('Open Ticket').setEmoji('📩').setStyle(ButtonStyle.Primary);
                const row = new ActionRowBuilder().addComponents(btn);
                const embed = new EB().setColor('Blue').setTitle('Support Tickets').setDescription('Click below to open a ticket.');
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: 'Ticket panel created!', ephemeral: true });
            }
            else if (sub === 'verification') {
                const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder: EB } = require('discord.js');
                const role = interaction.options.getRole('role');
                const btn = new ButtonBuilder().setCustomId(`verify_btn_${role.id}`).setLabel('Verify Me').setStyle(ButtonStyle.Success);
                const row = new ActionRowBuilder().addComponents(btn);
                const embed = new EB().setColor('Green').setTitle('Verification').setDescription('Click below to verify.');
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: 'Verification panel created!', ephemeral: true });
            }
        }

        if (group === 'settings') {
            if (sub === 'panic') {
                const enabled = interaction.options.getBoolean('enabled');
                updateGuildConfig(guildId, c => { c.panic.enabled = enabled; return c; });
                await interaction.reply({ content: `✅ Panic Mode is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`, ephemeral: true });
            }
            else if (sub === 'music_idle') {
                const mins = interaction.options.getNumber('minutes');
                updateGuildConfig(guildId, c => { c.music.idleMinutes = mins; return c; });
                await interaction.reply({ content: `✅ Music idle timer set to **${mins} minutes**.`, ephemeral: true });
            }
        }
    },
};
