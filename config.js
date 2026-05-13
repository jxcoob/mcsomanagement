//        SOD Utilities Config
require('dotenv').config();

module.exports = {

  // ── Bot Settings ──────────────────────────────────────────
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // ── Prefix ────────────────────────────────────────────────
  prefix: '-',

  // ── Roles ──────────────────────────────────────────────────
  roles: {
    // Role allowed to use all prefix commands (-say, -dm, -purge, etc.)
    prefixCommandRole: '1498131737623007374',
  },

};  