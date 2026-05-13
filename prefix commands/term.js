const ALLOWED_ROLES = [
  '1498131736478089264',
  '1498131737623007374',
];

const ROLES_TO_REMOVE = [
  '1498131737551831179',
  '1498131737551831177',
  '1498131737551831176',
  '1498131737551831175',
  '1498131737551831172',
  '1498131737551831171',
  '1498131737551831170',
  '1498131737450905799',
  '1498131737450905798',
  '1498131737450905797',
  '1503527121639837909',
  '1498131737450905796',
  '1498131737450905795',
  '1498131737136468066',
  '1498131737136468065',
  '1498131737136468064',
  '1498131737136468062',
  '1498131737136468061',
  '1498131737136468060',
  '1498131737136468059',
  '1498131737136468058',
  '1498131737044062330',
  '1498131737044062329',
  '1498131737044062328',
  '1498131737044062327',
  '1498131737044062326',
  '1498131737044062325',
  '1498131737044062324',
  '1498131737044062323',
  '1502150283961172029',
  '1498131737044062322',
  '1498131737044062321',
  '1498131736867897427',
  '1498131736867897426',
  '1498131736867897425',
  '1498131736750592210',
  '1498131736750592209',
  '1498131736750592208',
  '1498131736750592207',
  '1498131736750592206',
  '1498131736750592205',
  '1498131736750592204',
  '1498131736750592203',
  '1498131736750592202',
  '1498131736750592201',
  '1498131736478089265',
  '1498131736478089264',
  '1498131736478089263',
  '1498131736478089262',
  '1498131736478089261',
  '1498131736478089260',
  '1498131736478089259',
  '1498131736478089258',
  '1498131736478089257',
  '1498131736478089256',
  '1498131736448467053',
  '1498131736448467052',
  '1498131736448467051',
  '1498131736448467050',
  '1498131736448467049',
  '1498131736448467048',
  '1498131736406659107',
  '1498131736406659106',
  '1498131736406659105',
];

async function resolveUser(guild, input) {
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return guild.members.fetch(mentionMatch[1]).catch(() => null);
  if (/^\d+$/.test(input)) return guild.members.fetch(input).catch(() => null);
  const results = await guild.members.search({ query: input, limit: 5 }).catch(() => null);
  if (!results) return null;
  return results.find(m =>
    m.user.username.toLowerCase() === input.toLowerCase() ||
    m.user.tag.toLowerCase() === input.toLowerCase() ||
    m.displayName.toLowerCase() === input.toLowerCase()
  ) || null;
}

module.exports = {
  name: 'term',
  async execute(message, args) {
    // ── Permission check ─────────────────────────────────
    const hasPermission = message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasPermission) {
      return message.reply('You do not have permission to use this command.')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    if (!args.length) {
      return message.reply('Usage: `-term <user>`')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    const target = await resolveUser(message.guild, args[0]);
    if (!target) {
      return message.reply('Could not find that user.')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // ── Remove all roles ─────────────────────────────────
    const rolesToRemove = ROLES_TO_REMOVE.filter(id => target.roles.cache.has(id));
    if (rolesToRemove.length) {
      await target.roles.remove(rolesToRemove).catch(() => {});
    }

    await message.delete().catch(() => {});

    const notice = await message.channel.send(
      `${target.user.tag} has been terminated and had **${rolesToRemove.length}** role(s) removed.`
    );
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};
