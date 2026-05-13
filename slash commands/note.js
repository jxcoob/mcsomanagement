const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const FORUM_CHANNEL_ID = '1503191660471783524';
const ALLOWED_ROLES    = ['1498131737623007374', '1498131737551831176', '1498131737551831172'];
const MSRT_EMOJI       = '<:MCSO:1500184328632533203>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('note')
        .setDescription('Deputy note commands')
        .addSubcommand(sub =>
            sub
                .setName('log')
                .setDescription('Log an Deputy           note')
                .addUserOption(opt =>
                    opt
                        .setName('user')
                        .setDescription('The user to log a note on')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt
                        .setName('description')
                        .setDescription('The note description')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // ── Permission check ──────────────────────────────────────────────────
        const hasRole = ALLOWED_ROLES.some(id => interaction.member.roles.cache.has(id));
        if (!hasRole) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== 'log') return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const user        = interaction.options.getUser('user');
        const description = interaction.options.getString('description');
        const issuer      = interaction.user;

        // ── Format date/time ─────────────────────────────────────────────────
        const now     = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateTime = `${dateStr} @ ${timeStr}`;

        // ── Component v2 message payload ──────────────────────────────────────
        const messagePayload = {
            flags: MessageFlags.IsComponentsV2,
            components: [
                {
                    type: 17, // Container
                    components: [
                        {
                            type: 10, // Text Display
                            content: `**<:write:1503185616794554449> | <@${user.id}> Deputy Note** - ${dateTime}\n\n**Description:** ${description}\n\n-# Issued by <@${issuer.id}>.`,
                        },
                    ],
                },
            ],
        };

        // ── Find the forum channel ────────────────────────────────────────────
        const forumChannel = await interaction.client.channels.fetch(FORUM_CHANNEL_ID).catch(() => null);
        if (!forumChannel?.threads) {
            return interaction.editReply({ content: 'Could not find the deputy notes forum channel.' });
        }

        // ── Check for an existing thread for this user ────────────────────────
        const expectedTitle = `<@${user.id}>'s Notes`;
        let existingThread  = null;

        const activeThreads = await forumChannel.threads.fetchActive().catch(() => null);
        if (activeThreads) existingThread = activeThreads.threads.find(t => t.name === expectedTitle) ?? null;

        if (!existingThread) {
            const archivedThreads = await forumChannel.threads.fetchArchived({ limit: 100 }).catch(() => null);
            if (archivedThreads) existingThread = archivedThreads.threads.find(t => t.name === expectedTitle) ?? null;
        }

        if (existingThread) {
            if (existingThread.archived) await existingThread.setArchived(false).catch(() => null);
            await existingThread.send(messagePayload);
            return interaction.editReply({
                content: `Note added to: <#${existingThread.id}>`,
            });
        }

        // ── Create a new forum thread ─────────────────────────────────────────
        const newThread = await forumChannel.threads.create({
            name: expectedTitle,
            message: messagePayload,
        });

        return interaction.editReply({
            content: `Deputy note thread created: <#${newThread.id}>`,
        });
    },
};