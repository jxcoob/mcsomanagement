const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const FORUM_CHANNEL_ID  = '1503191977686994954';
const LOG_CHANNEL_ID    = '1503198129003036834';
const ROLES_FULL        = ['1498131737623007374', '1498131737551831179'];
const ROLES_LIMITED     = ['1498131737551831177', '1498131737551831172'];
const LIMITED_TYPES     = ['Activity Notice', 'Warning'];
const ROLE_CADET        = '1498131737450905797';
const ROLE_FULL_MENTION = '<@&1498131736478089264>';
const MCSO_EMOJI        = '<:MCSO:1500184328632533203>';
const INFRACTION_TYPES  = ['Activity Notice', 'Warning', 'Strike', 'Suspension', 'Termination'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infract')
        .setDescription('Issue an infraction against a user')
        .addUserOption(opt =>
            opt.setName('user').setDescription('The user to infract').setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('type').setDescription('The type of infraction').setRequired(true)
                .addChoices(...INFRACTION_TYPES.map(t => ({ name: t, value: t })))
        )
        .addStringOption(opt =>
            opt.setName('reason').setDescription('The reason for the infraction').setRequired(true)
        ),

    async execute(interaction) {
        const roles      = interaction.member.roles.cache;
        const hasFull    = ROLES_FULL.some(id => roles.has(id));
        const hasLimited = ROLES_LIMITED.some(id => roles.has(id));

        if (!hasFull && !hasLimited) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const target = interaction.options.getUser('user');
        const type   = interaction.options.getString('type');
        const reason = interaction.options.getString('reason');
        const issuer = interaction.user;

        if (!hasFull && hasLimited && !LIMITED_TYPES.includes(type)) {
            return interaction.editReply({
                content: `Your role can only issue the following infraction types: **${LIMITED_TYPES.join(', ')}**.`,
            });
        }

        const now     = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateTime = `${dateStr} @ ${timeStr}`;

        const infractionPayload = {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: 17,
                components: [{
                    type: 10,
                    content: `**${MCSO_EMOJI} <@${target.id}> MCSO Infraction** - ${type}\n\n${dateTime}\n\n**Reason:** ${reason}`,
                }],
            }],
        };

        const forumChannel = await interaction.client.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
        if (!forumChannel?.threads) {
            return interaction.editReply({ content: 'Could not find the infraction forum channel.' });
        }

        const expectedTitle = `<@${target.id}>'s Infractions`;
        let existingThread  = null;

        const active = await forumChannel.threads.fetchActive().catch(() => null);
        if (active) existingThread = active.threads.find(t => t.name === expectedTitle) ?? null;

        if (!existingThread) {
            const archived = await forumChannel.threads.fetchArchived({ limit: 100 }).catch(() => null);
            if (archived) existingThread = archived.threads.find(t => t.name === expectedTitle) ?? null;
        }

        let infractionMessage;

        if (existingThread) {
            if (existingThread.archived) await existingThread.setArchived(false).catch(() => null);
            infractionMessage = await existingThread.send(infractionPayload);
        } else {
            const newThread = await forumChannel.threads.create({
                name: expectedTitle,
                message: infractionPayload,
            });
            infractionMessage = await newThread.fetchStarterMessage().catch(() => null);
            existingThread = newThread;
        }

        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (targetMember?.roles.cache.has(ROLE_CADET)) {
            await existingThread.send({
                content: `${ROLE_FULL_MENTION}, this MCSO Probationary Deputy has received an infraction whilst on their Probationary phase. Please issue a termination if applicable.\n\n-# Probationary Deputy: <@${target.id}>`,
                allowedMentions: { roles: ['1498131736478089264'] },
            });
        }

        const guildId     = interaction.guildId;
        const messageLink = infractionMessage
            ? `https://discord.com/channels/${guildId}/${existingThread.id}/${infractionMessage.id}`
            : `https://discord.com/channels/${guildId}/${existingThread.id}`;

        try {
            await target.send(infractionPayload);
        } catch {
            // DMs closed, continue silently
        }

        try {
            const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID, { force: true });
            console.log('[infract] log channel type:', logChannel?.constructor?.name, '| type id:', logChannel?.type);
            await logChannel.send({
                flags: MessageFlags.IsComponentsV2,
                components: [{
                    type: 17,
                    components: [{
                        type: 10,
                        content: `**${MCSO_EMOJI} | <@${issuer.id}> MCSO Infraction Logged**\n\n${dateTime}\n\n${messageLink}\n\n-# ${type} issued against <@${target.id}>.`,
                    }],
                }],
            });
        } catch (err) {
            console.error('[infract] Failed to send to log channel:', err);
        }

        return interaction.editReply({
            content: `Infraction logged in <#${existingThread.id}>${infractionMessage ? ` ([jump to message](${messageLink}))` : ''}.`,
        });
    },
};