/**
 * prefix/adduser.js
 * Command: -adduser @user
 * Adds a user to the current ticket channel.
 * Restricted to role: 1498131737623007374
 */

'use strict';

const TICKET_CATEGORY = '1498131739325890742';
const COMMAND_ROLE_ID = '1498131737623007374';

module.exports = {
  name: 'adduser',
  async execute(message) {
    if (!message.member.roles.cache.has(COMMAND_ROLE_ID)) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    const channel = message.channel;
    if (channel.parentId !== TICKET_CATEGORY) {
      return message.reply({ content: 'This command can only be used inside a ticket channel.' });
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply({ content: 'Please mention a user. Usage: `-adduser @user`' });
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
  },
};
