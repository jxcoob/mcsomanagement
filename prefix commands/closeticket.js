/**
 * prefix/closeticket.js
 * Command: -closeticket [reason]
 * Closes and deletes the current ticket channel with a countdown.
 * Restricted to role: 1498131737623007374
 */

'use strict';

const config      = require('../config');
const ticketStore = require('../utils/ticketStore');

const TICKET_CATEGORY = '1498131739325890742';
const COMMAND_ROLE_ID = '1498131737623007374';

module.exports = {
  name: 'closeticket',
  async execute(message, args) {
    if (!message.member.roles.cache.has(COMMAND_ROLE_ID)) {
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

    // Revoke ticket owner view access
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
  },
};
