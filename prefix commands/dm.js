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
  name: 'dm',
  async execute(message, args) {
    if (args.length < 2) {
      return message.reply('Usage: `-dm <user> <text>`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    const target = await resolveUser(message.guild, args[0]);
    if (!target) {
      return message.reply('Could not find that user.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    const text = args.slice(1).join(' ');
    const sent = await target.send(text).catch(() => null);
    await message.delete().catch(() => {});
    if (!sent) {
      await message.channel.send(`Could not DM ${target.user.tag} — they may have DMs disabled.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  },
};
