const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { musicCommands, handleInteractionMusic } = require('../modules/music');
const { giveawayCommands, handleInteractionGiveaway } = require('../modules/giveaway');
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
            } else if (musicCommands.find(c => c.name === interaction.commandName)) {
                await handleInteractionMusic(interaction);
            } else if (giveawayCommands.find(c => c.name === interaction.commandName)) {
                await handleInteractionGiveaway(interaction);
            } else if (adminCommands.find(c => c.name === interaction.commandName)) {
                await handleInteractionAdmin(interaction);
            } else {
                console.error(`No command matching ${interaction.commandName} was found.`);
            }

            // Handle Button Interactions
        } else if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId.startsWith('verify_btn_')) {
                const roleId = customId.split('_')[2];
                // 1. Generate Math Problem
                const num1 = Math.floor(Math.random() * 10) + 1;
                const num2 = Math.floor(Math.random() * 10) + 1;
                const answer = (num1 + num2).toString();

                // 2. Store answer
                captchaCache.set(interaction.user.id, { answer, roleId });

                // 3. Show Modal
                const modal = new ModalBuilder()
                    .setCustomId('verify_modal')
                    .setTitle('Verification CAPTCHA');

                const captchaInput = new TextInputBuilder()
                    .setCustomId('captcha_input')
                    .setLabel(`What is ${num1} + ${num2}?`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(captchaInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }

            // --- TICKET SYSTEM ---
            else if (customId === 'open_ticket') {
                const channelName = `ticket-${interaction.user.username}`;
                const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);

                if (existingChannel) {
                    return interaction.reply({ content: `You already have a ticket open: ${existingChannel}`, ephemeral: true });
                }

                try {
                    const { ViewChannel, SendMessages, ReadMessageHistory } = require('discord.js').PermissionFlagsBits;

                    const channel = await interaction.guild.channels.create({
                        name: channelName,
                        type: 0, // GuildText
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [ViewChannel],
                            },
                            {
                                id: interaction.user.id,
                                allow: [ViewChannel, SendMessages, ReadMessageHistory],
                            },
                            {
                                id: interaction.client.user.id,
                                allow: [ViewChannel, SendMessages, ReadMessageHistory],
                            },
                        ],
                    });

                    const closeButton = require('discord.js').ButtonBuilder.from({
                        custom_id: 'close_ticket',
                        label: 'Close Ticket',
                        style: require('discord.js').ButtonStyle.Danger,
                    });

                    const row = require('discord.js').ActionRowBuilder.from({ components: [closeButton] });

                    await channel.send({
                        content: `Welcome ${interaction.user}! Support will be with you shortly.`,
                        components: [row]
                    });

                    await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: 'Failed to create ticket.', ephemeral: true });
                }
            }

            else if (customId === 'close_ticket') {
                await interaction.reply('Closing ticket in 5 seconds...');
                setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
            }

            // Handle Modal Submissions
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verify_modal') {
                const userInput = interaction.fields.getTextInputValue('captcha_input');
                const userData = captchaCache.get(interaction.user.id);

                if (!userData) {
                    return interaction.reply({ content: '❌ Session expired. Please click the button again.', ephemeral: true });
                }

                if (userInput.trim() === userData.answer) {
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
