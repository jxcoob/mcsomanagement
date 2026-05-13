const config = require('../config');

/**
 * Check if a member has at least one of the given role IDs.
 */
function hasAnyRole(member, roleIds) {
  return roleIds.some(id => member.roles.cache.has(id));
}

function isGeneralSupportMember(member) {
  return hasAnyRole(member, config.roles.generalSupport);
}

function isManagementSupportMember(member) {
  return hasAnyRole(member, config.roles.managementSupport);
}

/**
 * Ticket owner permission overwrites object (for use in channel.permissionOverwrites.edit)
 */
const TICKET_OWNER_PERMISSIONS = {
  SendMessages: true,
  EmbedLinks: true,
  AttachFiles: true,
  AddReactions: true,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  UseApplicationCommands: false,
  SendPolls: false,
  ReadMessageHistory: true,
  ViewChannel: true,
};

/**
 * Format a Date as a readable string.
 */
function formatDate(date) {
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

module.exports = {
  hasAnyRole,
  isGeneralSupportMember,
  isManagementSupportMember,
  TICKET_OWNER_PERMISSIONS,
  formatDate,
};
