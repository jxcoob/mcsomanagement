/**
 * utils/ticketStore.js
 * In-memory ticket store with category-based hydration for post-restart survival.
 */
const tickets = new Map();

/**
 * Infer the ticket type from the channel name.
 * Channels created by this bot are named  general-<username>  or  hr-<username>.
 */
function inferType(channelName = '') {
  if (channelName.startsWith('hr-'))      return 'management';
  if (channelName.startsWith('general-')) return 'general';
  return 'general'; // safe fallback
}

module.exports = {
  create(channelId, data) {
    tickets.set(channelId, {
      claimedBy:      null,
      claimedByTag:   null,
      closed:         false,
      managementType: null,
      escalated:      false,
      ...data,
      createdAt: new Date(),
    });
  },

  /**
   * Seed a minimal record for a ticket that existed before the last restart.
   * Only called when the channel is confirmed to be under the ticket category.
   */
  hydrate(channelId, data) {
    if (tickets.has(channelId)) return; // already known — don't overwrite
    tickets.set(channelId, {
      claimedBy:      null,
      claimedByTag:   null,
      closed:         false,
      managementType: null,
      escalated:      false,
      ownerId:        null,  // unknown after restart
      ownerTag:       null,
      reason:         '*(ticket predates last restart)*',
      ...data,
      createdAt: new Date(), // best we can do without persistence
    });
  },

  /**
   * Primary accessor used by interaction handlers.
   * If there is no in-memory record AND the channel lives under the ticket
   * category, a minimal hydrated record is created on the fly so the bot
   * continues to function correctly after a restart.
   *
   * @param {import('discord.js').GuildChannel} channel
   * @param {object} config  — your config module (needs config.channels.ticketCategory)
   * @returns {object|null}
   */
  getOrHydrate(channel, config) {
    if (tickets.has(channel.id)) return tickets.get(channel.id);

    // Not in memory — check whether this channel belongs to the ticket category.
    if (channel.parentId !== config.channels.ticketCategory) return null;

    // It's a ticket channel we don't have a record for (e.g. bot restarted).
    this.hydrate(channel.id, { type: inferType(channel.name) });
    return tickets.get(channel.id);
  },

  get(channelId) {
    return tickets.get(channelId) ?? null;
  },

  update(channelId, patch) {
    const existing = tickets.get(channelId);
    if (!existing) return false;
    tickets.set(channelId, { ...existing, ...patch });
    return true;
  },

  delete(channelId) {
    return tickets.delete(channelId);
  },

  findByOwnerAndType(userId, type) {
    for (const [channelId, data] of tickets) {
      if (data.ownerId === userId && data.type === type && !data.closed) return channelId;
    }
    return null;
  },

  findByOwner(userId) {
    for (const [channelId, data] of tickets) {
      if (data.ownerId === userId && !data.closed) return channelId;
    }
    return null;
  },

  all() {
    return tickets;
  },
};
