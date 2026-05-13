/**
 * prefix/remove.js
 * Command: -remove @user
 * Removes a user from the current ticket channel.
 * Restricted to role: 1498131737623007374
 */
'use strict';
const config      = require('../config');
const ticketStore = require('../utils/ticketStore');
const TICKET_CATEGORY = '1498131739325890742';
const COMMAND_ROLE_ID = '1498131737623007374';
module.exports = {
  name: 'remove',
  async execute(message) {
    await message.delete().catch(() => {});
    if (!message.member.roles.cache.has(COMMAND_ROLE_ID)) {
      return message.channel.send({ content: 'You do not have permission to use this command.' });
    }
    const channel = message.channel;
    if (channel.parentId !== TICKET_CATEGORY) {
      return message.channel.send({ content: 'This command can only be used inside a ticket channel.' });
    }
    const target = message.mentions.members.first();
    if (!target) {
      return message.channel.send({ content: 'Please mention a user. Usage: `-remove @user`' });
    }
    const ticket = ticketStore.getOrHydrate(channel, config);
    if (ticket && target.id === ticket.ownerId) {
      return message.channel.send({ content: 'You cannot remove the ticket owner from their own ticket.' });
    }
    try {
      await channel.permissionOverwrites.delete(target.id);
      return message.channel.send({ content: `${target} has been removed from this ticket.` });
    } catch (err) {
      console.error('[MCSO] Failed to remove user:', err);
      return message.channel.send({ content: 'Failed to remove that user from the ticket.' });
    }
  },
};
