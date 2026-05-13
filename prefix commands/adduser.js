/**
 * prefix/adduser.js
 * Command: -add @user
 * Adds a user to the current ticket channel.
 * Restricted to role: 1498131737623007374
 */
'use strict';
const TICKET_CATEGORY = '1498131739325890742';
const COMMAND_ROLE_ID = '1498131737623007374';
module.exports = {
  name: 'add',
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
      return message.channel.send({ content: 'Please mention a user. Usage: `-adduser @user`' });
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
      return message.channel.send({ content: `${target} has been added to this ticket.` });
    } catch (err) {
      console.error('[MCSO] Failed to add user:', err);
      return message.channel.send({ content: 'Failed to add that user to the ticket.' });
    }
  },
};
