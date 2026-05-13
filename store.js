// ── Shared in-memory store for removed roles ──────────────
// Key: userId → array of role IDs removed by -remove
const removedRoles = new Map();

module.exports = { removedRoles };
