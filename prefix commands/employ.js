const {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require('discord.js');

const ALLOWED_ROLES = [
  '1498131736478089264',
  '1498131737623007374',
];

const ROLES_TO_REMOVE = [
  '1498131736406659107',
  '1498131736406659106',
  '1498131736406659105',
  '1498131736360648751',
];

const ANNOUNCEMENT_CHANNEL_ID = '1498131739325890750';

const ROLES_TO_ADD = [
  '1498131737450905797',
  '1503527121639837909',
  '1498131737450905796',
  '1498131737450905795',
  '1498131737136468067',
  '1498131737136468066',
  '1498131737136468065',
  '1498131737044062327',
  '1498131737044062325',
  '1498131737044062323',
  '1502150283961172029',
  '1498131737044062322',
  '1498131737044062321',
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
  name: 'employ',
  async execute(message, args) {
    // ── Permission check ─────────────────────────────────
    const hasPermission = message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasPermission) {
      return message.reply('You do not have permission to use this command.')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    if (!args.length) {
      return message.reply('Usage: `-employ <user>`')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    const target = await resolveUser(message.guild, args[0]);
    if (!target) {
      return message.reply('Could not find that user.')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // ── Add employment roles ─────────────────────────────
    const rolesToAdd = ROLES_TO_ADD.filter(id => !target.roles.cache.has(id));
    if (rolesToAdd.length) {
      await target.roles.add(rolesToAdd).catch(() => {});
    }

    // ── Remove roles on employment ───────────────────────
    const rolesToRemove = ROLES_TO_REMOVE.filter(id => target.roles.cache.has(id));
    if (rolesToRemove.length) {
      await target.roles.remove(rolesToRemove).catch(() => {});
    }

    // ── Build and send DM container ──────────────────────
    const dmContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## MCSO Employment\n` +
          `Congratulations. You've succesfully passed your cadet phase, and are now entered into the one week probationary phase. During this phase, you'll be closely monitered at all times. Ensure to continue following all policies, regulations, and rules within the department.\n\n` +
          `**Next Steps:** You are now required to complete one field ride-along with a supervisor +, request for one here: https://discord.com/channels/1498131736305860708/1503526491600978062. If passed, you can start patrolling yourself. A 45 minute quota is required each week of you. If you have any additional questions, feel free to reach out to a supervisor.`
        )
      );

    const dmSent = await target.send({
      components: [dmContainer],
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => null);

    await message.delete().catch(() => {});

    // ── Send announcement to designated channel ──────────
    const announcementChannel = message.guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    if (announcementChannel) {
      const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      await announcementChannel.send(
        `**<:FTD:1502689730012381294> MCSO Field Training Cadet Phase Results - (${today})**\n\n` +
        `The following has their cadet phase and has took the next step into becoming a deputy within the Missoula County Sheriff's Office:\n\n` +
        `${target}\n\n` +
        `🎉 Congratulations on passing your cadet phase, we are excited to see you thrive within MCSO!\n` +
        `-# Processed by ${message.author}`
      ).catch(() => {});
    }

    if (!dmSent) {
      const notice = await message.channel.send(
        `${target.user.tag} has been employed and given **${rolesToAdd.length}** role(s), but their DMs are disabled so the employment message could not be sent.`
      );
      return setTimeout(() => notice.delete().catch(() => {}), 6000);
    }

    const notice = await message.channel.send(`${target.user.tag} has been successfully employed and notified via DM.`);
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};