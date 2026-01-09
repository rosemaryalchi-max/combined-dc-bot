const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { adminCommands, handleInteractionAdmin } = require('../modules/adminUtils');

// Simple in-memory cache for CAPTCHA answers: userId -> answer
// Note: Clears on restart
const captchaCache = new Map();

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (command) {
                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error executing ${interaction.commandName}`);
                    console.error(error);
                }
            } else if (adminCommands.find(c => c.name === interaction.commandName)) {
                await handleInteractionAdmin(interaction);
            } else {
                console.error(`No command matching ${interaction.commandName} was found.`);
            }

            // Handle Setup Menu Interactions (Select Menu / Buttons / Channel Select)
        } else if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
            if (interaction.customId.startsWith('setup_')) {
                const setupCmd = interaction.client.commands.get('setup');
                if (setupCmd && setupCmd.handleSetupInteraction) {
                    return setupCmd.handleSetupInteraction(interaction);
                }
            }

            // Continue with other buttons...
            if (interaction.isButton()) {
                const { customId } = interaction;
                // ... original button logic ...

                if (customId.startsWith('verify_btn_')) {
                    const roleId = customId.split('_')[2];

                    // Check if user already has the role
                    if (interaction.member.roles.cache.has(roleId)) {
                        return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
                    }

                    // Gen Image Captcha
                    const { createCaptcha } = require('../utils/captcha');
                    try {
                        const { buffer, answer } = await createCaptcha();

                        // Store answer (Case Insensitive)
                        captchaCache.set(interaction.user.id, { answer, roleId });

                        // Send Image + Button
                        const { AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
                        const attachment = new AttachmentBuilder(buffer, { name: 'captcha.png' });

                        const btn = new ButtonBuilder()
                            .setCustomId('submit_captcha_btn')
                            .setLabel('Enter Code')
                            .setStyle(ButtonStyle.Primary);

                        const row = new ActionRowBuilder().addComponents(btn);

                        await interaction.reply({
                            content: '📷 **Image Captcha**: Type the characters shown in the image below:',
                            files: [attachment],
                            components: [row],
                            ephemeral: true
                        });

                    } catch (e) {
                        console.error('Captcha error:', e);
                        await interaction.reply({ content: '❌ Failed to generate CAPTCHA. Please try again later.', ephemeral: true });
                    }
                }

                // Handle "Answer CAPTCHA" button
                else if (customId === 'submit_captcha_btn') {
                    if (!captchaCache.has(interaction.user.id)) {
                        return interaction.reply({ content: '❌ Session expired. Please click "Verify Me" again.', ephemeral: true });
                    }

                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId('verify_modal')
                        .setTitle('Enter Verification Code');

                    const input = new TextInputBuilder()
                        .setCustomId('captcha_input')
                        .setLabel('Type the characters from the image')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const row = new ActionRowBuilder().addComponents(input);
                    modal.addComponents(row);

                    await interaction.showModal(modal);
                }

                // --- TICKET SYSTEM ---
                else if (customId === 'open_ticket') {
                    const { getGuildConfig, updateGuildConfig } = require('../utils/guildConfig');

                    // Atomic increment ticket count
                    let ticketCount = 0;
                    updateGuildConfig(interaction.guild.id, (c) => {
                        const next = c.faucet ? c : { ...c }; // ensure object structure
                        if (!next.ticket) next.ticket = {};
                        next.ticket.count = (next.ticket.count || 0) + 1;
                        ticketCount = next.ticket.count;
                        return next;
                    });

                    const cfg = getGuildConfig(interaction.guild.id);
                    const template = cfg.ticket?.channelName || 'ticket-{username}';

                    // Format: ticket-username-number-open
                    const countStr = ticketCount.toString().padStart(4, '0');
                    const baseName = template
                        .replace('{username}', interaction.user.username)
                        .replace('{id}', interaction.user.id)
                        .replace('{count}', countStr); // Support {count} in template if they want custom placement

                    // If template didn't use count, append it. If it didn't use status, append it.
                    // User asked for: ticket-username-number-closed/open
                    // So default usage: ticket-user-0001-open
                    let channelName = baseName;
                    if (!channelName.includes(countStr)) channelName += `-${countStr}`;
                    channelName += '-open';

                    // Sanitize channel name (lowercase, dashes only)
                    channelName = channelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').substring(0, 100);

                    const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
                    if (existingChannel) {
                        return interaction.reply({ content: `You already have a ticket open: ${existingChannel}`, ephemeral: true });
                    }

                    try {
                        const { ViewChannel, SendMessages, ReadMessageHistory } = require('discord.js').PermissionFlagsBits;

                        const overwrites = [
                            { id: interaction.guild.id, deny: [ViewChannel] },
                            { id: interaction.user.id, allow: [ViewChannel, SendMessages, ReadMessageHistory] },
                            { id: interaction.client.user.id, allow: [ViewChannel, SendMessages, ReadMessageHistory] },
                        ];

                        if (cfg.ticket?.supportRoleId) {
                            const role = interaction.guild.roles.cache.get(cfg.ticket.supportRoleId);
                            if (role) overwrites.push({ id: role.id, allow: [ViewChannel, SendMessages, ReadMessageHistory] });
                        }

                        const channelOptions = {
                            name: channelName,
                            type: 0,
                            permissionOverwrites: overwrites,
                        };

                        if (cfg.ticket?.categoryOpenId) {
                            channelOptions.parent = cfg.ticket.categoryOpenId;
                        }

                        const channel = await interaction.guild.channels.create(channelOptions);

                        const closeButton = require('discord.js').ButtonBuilder.from({
                            custom_id: 'close_ticket',
                            label: 'Close Ticket',
                            style: require('discord.js').ButtonStyle.Danger,
                        });

                        const row = require('discord.js').ActionRowBuilder.from({ components: [closeButton] });

                        let welcomeMsg = cfg.ticket?.welcomeMessage || 'Welcome {user}! Support will be with you shortly.';
                        welcomeMsg = welcomeMsg.replace('{user}', interaction.user.toString());
                        if (cfg.ticket?.supportRoleId) welcomeMsg += ` <@&${cfg.ticket.supportRoleId}>`;

                        await channel.send({ content: welcomeMsg, components: [row] });
                        await interaction.reply({ content: `Ticket created: ${channel} (#${ticketCount})`, ephemeral: true });

                    } catch (error) {
                        console.error(error);
                        await interaction.reply({ content: 'Failed to create ticket.', ephemeral: true });
                    }
                }

                else if (customId === 'close_ticket') {
                    const { ViewChannel, SendMessages } = require('discord.js').PermissionFlagsBits;

                    await interaction.reply('🔒 Closing ticket...');

                    // 1. Rename to -closed
                    const oldName = interaction.channel.name;
                    const newName = oldName.replace(/-open$/, '-closed');
                    await interaction.channel.setName(newName).catch(e => console.warn('Rename failed:', e));

                    // 2. Lock Perms
                    const overwrites = interaction.channel.permissionOverwrites.cache.map(overwrite => {
                        if (overwrite.id === interaction.client.user.id) return overwrite;
                        const newAllow = overwrite.allow.remove(SendMessages);
                        const newDeny = overwrite.deny.add(SendMessages);
                        return { id: overwrite.id, allow: newAllow, deny: newDeny };
                    });
                    await interaction.channel.permissionOverwrites.set(overwrites);

                    // 3. Move to Closed Category
                    const { getGuildConfig } = require('../utils/guildConfig');
                    const cfg = getGuildConfig(interaction.guild.id);
                    if (cfg.ticket?.categoryClosedId) {
                        await interaction.channel.setParent(cfg.ticket.categoryClosedId, { lockPermissions: false }).catch(console.error);
                    }

                    // 4. Transcript
                    try {
                        if (cfg.ticket?.transcriptChannelId) {
                            const transcriptChannel = interaction.guild.channels.cache.get(cfg.ticket.transcriptChannelId);
                            if (transcriptChannel) {
                                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                                const content = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
                                const { AttachmentBuilder } = require('discord.js');
                                const attachment = new AttachmentBuilder(Buffer.from(content), { name: `transcript-${interaction.channel.name}.txt` });
                                await transcriptChannel.send({ content: `Ticket closed by ${interaction.user.tag}`, files: [attachment] });
                            }
                        }
                    } catch (e) {
                        console.error('Transcript error:', e);
                    }

                    // 5. Send "Delete" Button
                    const deleteBtn = require('discord.js').ButtonBuilder.from({
                        custom_id: 'delete_ticket',
                        label: '⛔ Delete Ticket',
                        style: require('discord.js').ButtonStyle.Secondary,
                    });
                    const row = require('discord.js').ActionRowBuilder.from({ components: [deleteBtn] });

                    await interaction.channel.send({ content: 'Ticket closed. Logs saved.', components: [row] });
                }

                else if (customId === 'delete_ticket') {
                    await interaction.reply('Deleting ticket...');
                    setTimeout(() => interaction.channel.delete().catch(console.error), 2000);
                }

                // Handle Modal Submissions
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verify_modal') {
                const userInput = interaction.fields.getTextInputValue('captcha_input');
                const userData = captchaCache.get(interaction.user.id);

                if (!userData) {
                    return interaction.reply({ content: '❌ Session expired. Please click the button again.', ephemeral: true });
                }

                if (userInput.trim().toLowerCase() === userData.answer.toLowerCase()) {
                    // Correct Answer
                    const role = interaction.guild.roles.cache.get(userData.roleId);
                    if (role) {
                        try {
                            await interaction.member.roles.add(role);
                            await interaction.reply({ content: `✅ **Verified!** Correct answer. You have been given the **${role.name}** role.`, ephemeral: true });
                        } catch (error) {
                            await interaction.reply({ content: '❌ Failed to give role. Check bot permissions.', ephemeral: true });
                        }
                    } else {
                        await interaction.reply({ content: '❌ Role not found.', ephemeral: true });
                    }
                } else {
                    // Incorrect Answer
                    await interaction.reply({ content: '❌ Incorrect CAPTCHA. Please try again.', ephemeral: true });
                }

                // Clear cache
                captchaCache.delete(interaction.user.id);
            }
        }
    },
};
