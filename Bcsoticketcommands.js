/**
 * commands/bcsoTicketCommands.js
 * Prefix commands for the BCSO ticket system.
 *
 * Commands:
 *   -sendpanel   — Posts the support panel into the configured channel.
 *   -adduser     — Adds a user to the current ticket channel.
 *   -removeuser  — Removes a user from the current ticket channel.
 *   -rename      — Renames the current ticket channel.
 *   -closeticket — Closes the current ticket (staff only).
 *
 * All commands restricted to role: 1498131737623007374
 * Panel is sent to channel: 1498131740697301196
 */

'use strict';

const { PermissionFlagsBits } = require('discord.js');

const config      = require('../config');
const ticketStore = require('../utils/ticketStore');

// ─── Constants ────────────────────────────────────────────────────────────────
const PANEL_CHANNEL_ID  = '1498131740697301196';
const TICKET_CATEGORY   = '1498131739325890742';
const COMMAND_ROLE_ID   = '1498131737623007374';

const BANNER_URL       = 'https://cdn.discordapp.com/attachments/1498131738671452268/1504217842243862609/FTD_application.png?ex=6a062f88&is=6a04de08&hm=353c0b0b3ef13ceea600d0b407e7359b8576522b47e690dd500bf76ca0e6adaa&animated=true&';
const BANNER_PROXY_URL = 'https://media.discordapp.net/attachments/1498131738671452268/1504217842243862609/FTD_application.png?ex=6a062f88&is=6a04de08&hm=353c0b0b3ef13ceea600d0b407e7359b8576522b47e690dd500bf76ca0e6adaa&';
const FOOTER_URL       = 'https://cdn.discordapp.com/attachments/1498131738671452268/1502424978421973063/CADET_TRAINING.png?ex=6a05988c&is=6a04470c&hm=120b1d867136a218f89f4394d15dec9de30870b7eaf1d21c8ae9cbcb148eb1a0&animated=true&';
const FOOTER_PROXY_URL = 'https://media.discordapp.net/attachments/1498131738671452268/1502424978421973063/CADET_TRAINING.png?ex=6a05988c&is=6a04470c&hm=120b1d867136a218f89f4394d15dec9de30870b7eaf1d21c8ae9cbcb148eb1a0&';

// ─── Permission guard ─────────────────────────────────────────────────────────
function hasCommandRole(member) {
  return member.roles.cache.has(COMMAND_ROLE_ID);
}

// ─── Panel payload ────────────────────────────────────────────────────────────
function buildPanelPayload() {
  return {
    flags:           1 << 15,
    allowedMentions: { parse: [] },
    components: [
      {
        id:           1,
        type:         17,
        accent_color: null,
        spoiler:      false,
        components: [
          {
            id:   2,
            type: 12,
            items: [{
              media: {
                url:          BANNER_URL,
                proxy_url:    BANNER_PROXY_URL,
                width:        1254,
                height:       333,
                content_type: 'image/webp',
              },
              description: null,
              spoiler:     false,
            }],
          },
          { id: 3, type: 14, divider: true, spacing: 2 },
          {
            id:      4,
            type:    10,
            content: "## Briarfield County Sheriff's Office Support\n\n> Welcome to the BCSO support panel. Here you will be able to create support tickets for anything you may need support with. Before creating a support ticket, we ask to please read below to be informed on what type of ticket you should open for your issue.\n\n❓ **General Support Ticket**\n\n> A general support ticket is used for any inquires, questions, or concerns you may have. We ask you to please check the information channel before creating this type of ticket to ensure you won't ask a question that can be resolved by simply checking the information channel.\n\n📝 **Internal Affairs Support Ticket**\n\n> An internal affairs support ticket (IA Ticket) is used for deputy reports, or anything that requires the assistance of the command team+. Before making a report, please ensure it is reasonable as petty reports will be ignored.",
          },
          { id: 5, type: 14, divider: true, spacing: 1 },
          {
            id:   6,
            type: 12,
            items: [{
              media: {
                url:          FOOTER_URL,
                proxy_url:    FOOTER_PROXY_URL,
                width:        1254,
                height:       100,
                content_type: 'image/png',
              },
              description: null,
              spoiler:     false,
            }],
          },
        ],
      },
      {
        type:       1,
        components: [{
          type:        3,
          custom_id:   'p_301821495703769089',
          placeholder: 'Select a ticket type.',
          min_values:  1,
          max_values:  1,
          options: [
            { label: 'General Support',           value: 'TijUetP4eh', emoji: { name: '❓' } },
            { label: 'Internal Affairs Support',  value: 'LrsOU5WLvy', emoji: { name: '📝' } },
          ],
        }],
      },
    ],
  };
}

// ─── Command: !sendpanel ──────────────────────────────────────────────────────
async function cmdSendPanel(message) {
  if (!hasCommandRole(message.member)) {
    return message.reply({ content: 'You do not have permission to use this command.' });
  }

  let targetChannel;
  try {
    targetChannel = await message.client.channels.fetch(PANEL_CHANNEL_ID);
  } catch {
    return message.reply({ content: `Could not find the panel channel (<#${PANEL_CHANNEL_ID}>).` });
  }

  try {
    await targetChannel.send(buildPanelPayload());
    return message.reply({ content: `Support panel sent to <#${PANEL_CHANNEL_ID}>.` });
  } catch (err) {
    console.error('[BCSO] Failed to send panel:', err);
    return message.reply({ content: 'Failed to send the panel. Check bot permissions in that channel.' });
  }
}

// ─── Command: !adduser @user ──────────────────────────────────────────────────
async function cmdAddUser(message) {
  if (!hasCommandRole(message.member)) {
    return message.reply({ content: 'You do not have permission to use this command.' });
  }

  const channel = message.channel;
  if (channel.parentId !== TICKET_CATEGORY) {
    return message.reply({ content: 'This command can only be used inside a ticket channel.' });
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply({ content: 'Please mention a user. Usage: `!adduser @user`' });
  }

  try {
    await channel.permissionOverwrites.edit(target.id, {
      ViewChannel:        true,
      SendMessages:       true,
      ReadMessageHistory: true,
      AttachFiles:        true,
      EmbedLinks:         true,
      AddReactions:       true,
    });
    return message.reply({ content: `✅ ${target} has been added to this ticket.` });
  } catch (err) {
    console.error('[BCSO] Failed to add user:', err);
    return message.reply({ content: 'Failed to add that user to the ticket.' });
  }
}

// ─── Command: !removeuser @user ──────────────────────────────────────────────
async function cmdRemoveUser(message) {
  if (!hasCommandRole(message.member)) {
    return message.reply({ content: 'You do not have permission to use this command.' });
  }

  const channel = message.channel;
  if (channel.parentId !== TICKET_CATEGORY) {
    return message.reply({ content: 'This command can only be used inside a ticket channel.' });
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply({ content: 'Please mention a user. Usage: `!removeuser @user`' });
  }

  const ticket = ticketStore.getOrHydrate(channel, config);
  if (ticket && target.id === ticket.ownerId) {
    return message.reply({ content: 'You cannot remove the ticket owner from their own ticket.' });
  }

  try {
    await channel.permissionOverwrites.delete(target.id);
    return message.reply({ content: `✅ ${target} has been removed from this ticket.` });
  } catch (err) {
    console.error('[BCSO] Failed to remove user:', err);
    return message.reply({ content: 'Failed to remove that user from the ticket.' });
  }
}

// ─── Command: !rename <new name> ─────────────────────────────────────────────
async function cmdRename(message, args) {
  if (!hasCommandRole(message.member)) {
    return message.reply({ content: 'You do not have permission to use this command.' });
  }

  const channel = message.channel;
  if (channel.parentId !== TICKET_CATEGORY) {
    return message.reply({ content: 'This command can only be used inside a ticket channel.' });
  }

  const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!newName) {
    return message.reply({ content: 'Please provide a valid new name. Usage: `!rename new-channel-name`' });
  }

  try {
    await channel.setName(newName);
    return message.reply({ content: `Channel renamed to **${newName}**.` });
  } catch (err) {
    console.error('[BCSO] Failed to rename channel:', err);
    return message.reply({ content: 'Failed to rename the channel.' });
  }
}

// ─── Command: !closeticket [reason] ──────────────────────────────────────────
async function cmdCloseTicket(message, args) {
  if (!hasCommandRole(message.member)) {
    return message.reply({ content: 'You do not have permission to use this command.' });
  }

  const channel = message.channel;
  if (channel.parentId !== TICKET_CATEGORY) {
    return message.reply({ content: 'This command can only be used inside a ticket channel.' });
  }

  const ticket = ticketStore.getOrHydrate(channel, config);
  if (!ticket) {
    return message.reply({ content: 'This channel is not a recognised ticket.' });
  }

  const reason = args.join(' ') || '*(no reason provided)*';

  // Revoke ticket owner view
  try { await channel.permissionOverwrites.edit(ticket.ownerId, { ViewChannel: false }); } catch (_) {}

  // Countdown
  const COUNTDOWN = 5;
  let countdownMsg;
  const countdownContent = i => ({
    flags:      1 << 15,
    components: [{
      type:         17,
      accent_color: null,
      components:   [{ type: 10, content: `## Ticket Closure\nTicket is closing in **${i}** second${i === 1 ? '' : 's'}.` }],
    }],
  });

  try { countdownMsg = await channel.send(countdownContent(COUNTDOWN)); } catch (_) {}

  for (let i = COUNTDOWN - 1; i >= 1; i--) {
    await new Promise(r => setTimeout(r, 1000));
    try { await countdownMsg.edit(countdownContent(i)); } catch (_) {}
  }
  await new Promise(r => setTimeout(r, 1000));

  ticketStore.update(channel.id, { closed: true });
  channel.delete(`Ticket closed by ${message.author.tag} — ${reason}`).catch(() => {});
}

// ─── Main message handler — call this from your messageCreate event ────────────
async function handle(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const [command, ...args] = message.content.slice(1).trim().split(/\s+/);

  switch (command.toLowerCase()) {
    case 'sendpanel':   return cmdSendPanel(message);
    case 'adduser':     return cmdAddUser(message);
    case 'removeuser':  return cmdRemoveUser(message);
    case 'rename':      return cmdRename(message, args);
    case 'closeticket': return cmdCloseTicket(message, args);
    default:            return; // not our command
  }
}

module.exports = { handle };
