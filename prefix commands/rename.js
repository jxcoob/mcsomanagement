/**
 * prefix/rename.js
 * Command: -rename <new name>
 * Renames the current ticket channel.
 * Restricted to role: 1498131737623007374
 */

'use strict';

const TICKET_CATEGORY = '1498131739325890742';
const COMMAND_ROLE_ID = '1498131737623007374';

module.exports = {
  name: 'rename',
  async execute(message, args) {
    if (!message.member.roles.cache.has(COMMAND_ROLE_ID)) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    const channel = message.channel;
    if (channel.parentId !== TICKET_CATEGORY) {
      return message.reply({ content: 'This command can only be used inside a ticket channel.' });
    }

    const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!newName) {
      return message.reply({ content: 'Please provide a valid new name. Usage: `-rename new-channel-name`' });
    }

    try {
      await channel.setName(newName);
      return message.reply({ content: `✅ Channel renamed to **${newName}**.` });
    } catch (err) {
      console.error('[BCSO] Failed to rename channel:', err);
      return message.reply({ content: 'Failed to rename the channel.' });
    }
  },
};
