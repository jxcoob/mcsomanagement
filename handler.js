/**
 * handlers/bcsoTicketHandler.js
 * Missoula County Sheriff's Office ticket system.
 * Ticket types: general, ia_other, ia_deputy
 */

'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');

const JSZip = require('jszip');

const config      = require('../config');
const ticketStore = require('../utils/ticketStore');
const { generateTranscript }          = require('../utils/transcript');
const { formatDate }                  = require('../utils/helpers');

// ─── IDs ─────────────────────────────────────────────────────────────────────
const IDS = {
  // Select menu on the panel
  SUPPORT_SELECT:      'p_301821495703769089',
  // IA type select (ephemeral follow-up)
  IA_TYPE_SELECT:      'bcso_ia_type_select',

  // Modals
  GENERAL_MODAL:       'bcso_modal_general',
  IA_OTHER_MODAL:      'bcso_modal_ia_other',
  IA_DEPUTY_MODAL:     'bcso_modal_ia_deputy',
  CLOSE_REASON_MODAL:  'bcso_close_reason_modal',

  // Ticket action buttons (shared across all ticket types)
  CLAIM_BTN:           'p_301825461015547940',
  UNCLAIM_BTN:         'bcso_btn_unclaim',
  CLOSE_BTN:           'p_301825499246628901',
  CLOSE_CONFIRM_BTN:   'bcso_close_confirm',
  CLOSE_CANCEL_BTN:    'bcso_close_cancel',
  ESCALATE_BTN:        'p_301825548080910374',
  ESCALATE_USED_BTN:   'bcso_btn_escalate_used',
};

// ─── Config ──────────────────────────────────────────────────────────────────
const TICKET_CATEGORY  = '1498131739325890742';
const TRANSCRIPT_LOG   = config.channels?.bcsoTranscriptLog ?? config.channels?.transcriptLog;

// Roles allowed to act on each ticket type
const ROLES = {
  general:   config.roles?.bcsoGeneralSupport  ?? [],   // fill in config or hardcode below
  ia:        config.roles?.bcsoIASupport        ?? [],
};

// Escalation ping roles
const ESCALATE_ROLE = {
  general:   '1498131737551831176',
  ia_other:  '1498131737623007374',
  ia_deputy: '1498131737623007374',
};

// ─── Image block (shared banner) ─────────────────────────────────────────────
function bannerBlock() {
  return {
    id:   2,
    type: 12,
    items: [{
      media: {
        url:          'https://cdn.discordapp.com/attachments/1498131738671452268/1504217842243862609/FTD_application.png?ex=6a062f88&is=6a04de08&hm=353c0b0b3ef13ceea600d0b407e7359b8576522b47e690dd500bf76ca0e6adaa&animated=true&',
        proxy_url:    'https://media.discordapp.net/attachments/1498131738671452268/1504217842243862609/FTD_application.png?ex=6a062f88&is=6a04de08&hm=353c0b0b3ef13ceea600d0b407e7359b8576522b47e690dd500bf76ca0e6adaa&',
        width:        1254,
        height:       333,
        content_type: 'image/webp',
      },
      description: null,
      spoiler:     false,
    }],
  };
}

function actionRow() {
  return {
    type:       1,
    components: [
      { type: 2, style: 3, label: 'Claim',    custom_id: IDS.CLAIM_BTN    },
      { type: 2, style: 2, label: 'Close',    custom_id: IDS.CLOSE_BTN    },
      { type: 2, style: 1, label: 'Escalate', custom_id: IDS.ESCALATE_BTN },
    ],
  };
}

// ─── Ticket message builders ──────────────────────────────────────────────────
function buildGeneralTicketMessage(user, reason) {
  return {
    flags:           1 << 15,
    allowedMentions: { parse: ['everyone', 'roles', 'users'] },
    components: [
      { type: 10, content: '@everyone' },
      {
        id:           1,
        type:         17,
        accent_color: null,
        spoiler:      false,
        components: [
          bannerBlock(),
          { id: 3, type: 14, divider: true,  spacing: 1 },
          {
            id:      4,
            type:    10,
            content: `## General Support Ticket\n\nHello ${user}, welcome to your general support ticket.\n\n<:Information:1504227484265091102> We're happy to assist you. To help us respond, please elaborate down below on any additional information you may have on your reason for opening a ticket so our support team can assist you to the best they can.\n\n**Ticket Reason:** \`${reason}\`\n\n-# Please be patient whilst waiting for someone to assist you.`,
          },
          { id: 5, type: 14, divider: true,  spacing: 2 },
          actionRow(),
        ],
      },
    ],
  };
}

function buildIAOtherTicketMessage(user, reason) {
  return {
    flags:           1 << 15,
    allowedMentions: { parse: ['everyone', 'roles', 'users'] },
    components: [
      { type: 10, content: '@everyone' },
      {
        id:           1,
        type:         17,
        accent_color: null,
        spoiler:      false,
        components: [
          bannerBlock(),
          { id: 3, type: 14, divider: true,  spacing: 1 },
          {
            id:      4,
            type:    10,
            content: `## Internal Affairs Support Ticket\n\nHello ${user}, welcome to your internal affairs support ticket.\n\n<:Information:1504227484265091102> We're happy to assist you. To help us respond, please elaborate down below on any additional information you may have on your reason for opening a ticket so our support team can assist you to the best they can.\n\n**Ticket Reason:** \`${reason}\`\n\n-# Please be patient whilst waiting for someone to assist you.`,
          },
          { id: 5, type: 14, divider: true,  spacing: 2 },
          actionRow(),
        ],
      },
    ],
  };
}

function buildIADeputyTicketMessage(user, deputy, reportReason, proof) {
  return {
    flags:           1 << 15,
    allowedMentions: { parse: ['everyone', 'roles', 'users'] },
    components: [
      { type: 10, content: '@everyone' },
      {
        id:           1,
        type:         17,
        accent_color: null,
        spoiler:      false,
        components: [
          bannerBlock(),
          { id: 3, type: 14, divider: true,  spacing: 1 },
          {
            id:      4,
            type:    10,
            content: `## Internal Affairs - Deputy Report\n\nHello ${user}, welcome to your internal affairs deputy report ticket.\n\n<:Information:1504227484265091102> We're happy to assist you. To help us respond, please elaborate down below on any additional information you may have on your reason for opening a ticket so our support team can assist you to the best they can.\n\n**Deputy:**\n\`\`\`${deputy}\`\`\`\n**Reason for report:**\n\`\`\`${reportReason}\`\`\`\n**Proof:**\n\`\`\`${proof}\`\`\`\n-# Please be patient whilst waiting for someone to assist you.`,
          },
          { id: 5, type: 14, divider: true,  spacing: 2 },
          actionRow(),
        ],
      },
    ],
  };
}

// ─── Permission helpers ───────────────────────────────────────────────────────
function hasRole(member, roleIds) {
  return roleIds.some(id => member.roles.cache.has(id));
}

function canActOnTicket(member, ticket) {
  if (ticket.type === 'general')   return hasRole(member, ROLES.general);
  if (ticket.type === 'ia_other')  return hasRole(member, ROLES.ia);
  if (ticket.type === 'ia_deputy') return hasRole(member, ROLES.ia);
  return false;
}

function buildPermissionOverwrites(guild, ownerId, type) {
  const staffRoles = type === 'general' ? ROLES.general : ROLES.ia;
  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
  ];

  return [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id:    ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ReadMessageHistory,
      ],
      deny: [
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.SendPolls,
      ],
    },
    ...staffRoles.map(id => ({ id, allow: staffAllow })),
  ];
}

// ─── Component helpers ────────────────────────────────────────────────────────
function walkComponents(components, fn) {
  for (const comp of components) {
    fn(comp);
    if (Array.isArray(comp.components)) walkComponents(comp.components, fn);
  }
}

function swapButton(components, fromId, toId, toLabel, toStyle) {
  walkComponents(components, comp => {
    if (comp.custom_id === fromId) {
      comp.custom_id = toId;
      comp.label     = toLabel;
      comp.style     = toStyle;
    }
  });
}

function disableButton(components, customId) {
  walkComponents(components, comp => {
    if (comp.custom_id === customId) comp.disabled = true;
  });
}

function cloneComponents(msg) {
  return JSON.parse(JSON.stringify(msg.components.map(r => r.toJSON())));
}

// ─── Handler: panel select ────────────────────────────────────────────────────
async function handleSupportSelect(interaction) {
  const value = interaction.values[0];

  // General support → straight to modal
  if (value === 'TijUetP4eh') {
    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(IDS.GENERAL_MODAL)
        .setTitle('General Support')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Why are you creating this ticket?')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000),
          ),
        ),
    );
  }

  // IA support → pick sub-type first
  if (value === 'LrsOU5WLvy') {
    return interaction.reply({
      ephemeral:  true,
      content:    '### Internal Affairs Support\nPlease select the type of request below.',
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(IDS.IA_TYPE_SELECT)
            .setPlaceholder('Select a type...')
            .addOptions([
              { label: 'Deputy Report', value: 'Deputy Report' },
              { label: 'Other',         value: 'Other'         },
            ]),
        ),
      ],
    });
  }
}

// ─── Handler: IA type select ──────────────────────────────────────────────────
async function handleIATypeSelect(interaction) {
  const type = interaction.values[0];

  if (type === 'Deputy Report') {
    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(IDS.IA_DEPUTY_MODAL)
        .setTitle('Deputy Report')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('deputy')
              .setLabel('Deputy (Callsign | Username)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(200),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('report_reason')
              .setLabel('Reason for report')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('proof')
              .setLabel('Proof')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000),
          ),
        ),
    );
  }

  if (type === 'Other') {
    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(IDS.IA_OTHER_MODAL)
        .setTitle('Internal Affairs Support')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Why are you creating this ticket?')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000),
          ),
        ),
    );
  }
}

// ─── Handler: general modal submit ───────────────────────────────────────────
async function handleGeneralModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { user, guild } = interaction;

  const existing = ticketStore.findByOwnerAndType(user.id, 'general');
  if (existing) {
    return interaction.editReply({
      content: `You already have an open general support ticket: <#${existing}>. Please use that ticket or wait for it to be closed before opening another.`,
    });
  }

  const reason      = interaction.fields.getTextInputValue('reason');
  const channelName = `general-${user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name:                 channelName,
      parent:               TICKET_CATEGORY,
      permissionOverwrites: buildPermissionOverwrites(guild, user.id, 'general'),
    });
  } catch (err) {
    console.error('[BCSO TICKET] Failed to create general channel:', err);
    return interaction.editReply({ content: 'Failed to create ticket channel. Please contact an admin.' });
  }

  ticketStore.create(channel.id, {
    type:     'general',
    ownerId:  user.id,
    ownerTag: user.tag,
    reason,
    escalated: false,
  });

  await channel.send(buildGeneralTicketMessage(user, reason));
  return interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
}

// ─── Handler: IA Other modal submit ──────────────────────────────────────────
async function handleIAOtherModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { user, guild } = interaction;

  const existing = ticketStore.findByOwnerAndType(user.id, 'ia_other');
  if (existing) {
    return interaction.editReply({
      content: `You already have an open IA support ticket: <#${existing}>. Please use that ticket or wait for it to be closed before opening another.`,
    });
  }

  const reason      = interaction.fields.getTextInputValue('reason');
  const channelName = `ia-${user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name:                 channelName,
      parent:               TICKET_CATEGORY,
      permissionOverwrites: buildPermissionOverwrites(guild, user.id, 'ia'),
    });
  } catch (err) {
    console.error('[BCSO TICKET] Failed to create IA Other channel:', err);
    return interaction.editReply({ content: 'Failed to create ticket channel. Please contact an admin.' });
  }

  ticketStore.create(channel.id, {
    type:      'ia_other',
    ownerId:   user.id,
    ownerTag:  user.tag,
    reason,
    escalated: false,
  });

  await channel.send(buildIAOtherTicketMessage(user, reason));
  return interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
}

// ─── Handler: IA Deputy modal submit ─────────────────────────────────────────
async function handleIADeputyModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { user, guild } = interaction;

  const existing = ticketStore.findByOwnerAndType(user.id, 'ia_deputy');
  if (existing) {
    return interaction.editReply({
      content: `You already have an open deputy report ticket: <#${existing}>. Please use that ticket or wait for it to be closed before opening another.`,
    });
  }

  const deputy       = interaction.fields.getTextInputValue('deputy');
  const reportReason = interaction.fields.getTextInputValue('report_reason');
  const proof        = interaction.fields.getTextInputValue('proof');
  const channelName  = `deputy-report-${user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name:                 channelName,
      parent:               TICKET_CATEGORY,
      permissionOverwrites: buildPermissionOverwrites(guild, user.id, 'ia'),
    });
  } catch (err) {
    console.error('[BCSO TICKET] Failed to create IA Deputy channel:', err);
    return interaction.editReply({ content: 'Failed to create ticket channel. Please contact an admin.' });
  }

  ticketStore.create(channel.id, {
    type:         'ia_deputy',
    ownerId:      user.id,
    ownerTag:     user.tag,
    deputy,
    reportReason,
    proof,
    reason:       `Deputy Report: ${deputy}`,
    escalated:    false,
  });

  await channel.send(buildIADeputyTicketMessage(user, deputy, reportReason, proof));
  return interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
}

// ─── Handler: Claim ───────────────────────────────────────────────────────────
async function handleClaim(interaction) {
  const ticket = ticketStore.getOrHydrate(interaction.channel, config);
  if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', ephemeral: true });
  if (!canActOnTicket(interaction.member, ticket))
    return interaction.reply({ content: 'You do not have permission to claim this ticket.', ephemeral: true });

  ticketStore.update(interaction.channel.id, {
    claimedBy:    interaction.user.id,
    claimedByTag: interaction.user.tag,
  });

  try {
    const components = cloneComponents(interaction.message);
    swapButton(components, IDS.CLAIM_BTN, IDS.UNCLAIM_BTN, 'Unclaim', 4);
    await interaction.message.edit({ components });
  } catch (_) {}

  return interaction.reply({ content: `Successfully claimed by ${interaction.user}` });
}

// ─── Handler: Unclaim ─────────────────────────────────────────────────────────
async function handleUnclaim(interaction) {
  const ticket = ticketStore.getOrHydrate(interaction.channel, config);
  if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', ephemeral: true });
  if (ticket.claimedBy !== interaction.user.id)
    return interaction.reply({ content: 'You have not claimed this ticket. Only the staff member who claimed it can unclaim it.', ephemeral: true });

  ticketStore.update(interaction.channel.id, { claimedBy: null, claimedByTag: null });

  try {
    const components = cloneComponents(interaction.message);
    swapButton(components, IDS.UNCLAIM_BTN, IDS.CLAIM_BTN, 'Claim', 3);
    await interaction.message.edit({ components });
  } catch (_) {}

  return interaction.reply({ content: `Successfully unclaimed by ${interaction.user}` });
}

// ─── Handler: Close button ────────────────────────────────────────────────────
async function handleCloseButton(interaction) {
  const ticket = ticketStore.getOrHydrate(interaction.channel, config);
  if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', ephemeral: true });
  if (!canActOnTicket(interaction.member, ticket))
    return interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });

  return interaction.reply({
    flags:     1 << 15,
    ephemeral: true,
    components: [{
      type:         17,
      accent_color: null,
      components: [
        { type: 10, content: '## Ticket Closure\nPlease confirm by selecting **Confirm** below in order to close this ticket. If this was a mistake, select **Cancel**.' },
        { type: 14, divider: false, spacing: 1 },
        {
          type:       1,
          components: [
            { type: 2, style: 3, label: 'Confirm', custom_id: IDS.CLOSE_CONFIRM_BTN },
            { type: 2, style: 4, label: 'Cancel',  custom_id: IDS.CLOSE_CANCEL_BTN  },
          ],
        },
      ],
    }],
  });
}

// ─── Handler: Close confirm ───────────────────────────────────────────────────
async function handleCloseConfirm(interaction) {
  return interaction.showModal(
    new ModalBuilder()
      .setCustomId(IDS.CLOSE_REASON_MODAL)
      .setTitle('Close Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Reason? (Leave empty if none)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500),
        ),
      ),
  );
}

// ─── Handler: Close cancel ────────────────────────────────────────────────────
async function handleCloseCancel(interaction) {
  return interaction.update({
    flags:      1 << 15,
    components: [{
      type:         17,
      accent_color: null,
      components:   [{ type: 10, content: 'Ticket closure cancelled.' }],
    }],
  });
}

// ─── Handler: Close reason modal ─────────────────────────────────────────────
async function handleCloseReasonModal(interaction, client) {
  await interaction.deferUpdate().catch(() => {});

  const channel = interaction.channel;
  const ticket  = ticketStore.getOrHydrate(channel, config);
  if (!ticket) return;

  const closeReason = interaction.fields.getTextInputValue('close_reason') || '';
  const closedBy    = interaction.user;
  const closedAt    = new Date();

  try { await channel.permissionOverwrites.edit(ticket.ownerId, { ViewChannel: false }); } catch (_) {}

  // Countdown
  const COUNTDOWN = 5;
  let countdownMsg;
  const countdownContent = i => ({
    flags:      1 << 15,
    components: [{
      type:         17,
      accent_color: null,
      components:   [{ type: 10, content: `## Ticket Closure\nTicket is closing in **${i}** second${i === 1 ? '' : 's'}.` }],
    }],
  });

  try { countdownMsg = await channel.send(countdownContent(COUNTDOWN)); } catch (_) {}

  for (let i = COUNTDOWN - 1; i >= 1; i--) {
    await new Promise(r => setTimeout(r, 1000));
    try { await countdownMsg.edit(countdownContent(i)); } catch (_) {}
  }
  await new Promise(r => setTimeout(r, 1000));

  // Transcript
  let transcriptBuffer;
  try {
    transcriptBuffer = await generateTranscript(channel);
  } catch (err) {
    console.error('[BCSO TICKET] Failed to generate transcript:', err);
    transcriptBuffer = Buffer.from('<html><body>Transcript generation failed.</body></html>', 'utf8');
  }

  const htmlName   = `transcript-${channel.name}-${Date.now()}`;
  const zip        = new JSZip();
  zip.file(`${htmlName}.html`, transcriptBuffer);
  const zipBuffer  = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const attachment = new AttachmentBuilder(zipBuffer, { name: `${htmlName}.zip` });

  const typeLabel =
    ticket.type === 'general'    ? 'General Support'            :
    ticket.type === 'ia_other'   ? 'Internal Affairs - Other'   :
    ticket.type === 'ia_deputy'  ? 'Internal Affairs - Deputy Report' :
                                   'Ticket';

  const logChannelId = TRANSCRIPT_LOG;
  const logChannel   = logChannelId
    ? await client.channels.fetch(logChannelId).catch(() => null)
    : null;

  if (logChannel) {
    await logChannel.send({
      allowedMentions: { parse: [] },
      flags:           1 << 15,
      components: [{
        type:         17,
        accent_color: null,
        components: [
          { type: 10, content: `## Ticket Transcript — ${typeLabel}` },
          { type: 14, divider: true, spacing: 2 },
          {
            type:    10,
            content: [
              `**Opened by:** <@${ticket.ownerId}>`,
              `**Ticket reason:** ${ticket.reason || 'N/A'}`,
              `**Date/Time:** ${formatDate(ticket.createdAt)}`,
              ``,
              `**Closed by:** ${closedBy}`,
              `**Closed for:** ${closeReason || '*(no reason provided)*'}`,
              `**Closed on:** ${formatDate(closedAt)}`,
            ].join('\n'),
          },
        ],
      }],
    });
    await logChannel.send({ allowedMentions: { parse: [] }, files: [attachment] });
  }

  ticketStore.update(channel.id, { closed: true });
  channel.delete(`Ticket closed by ${closedBy.tag}`).catch(() => {});
}

// ─── Handler: Escalate ────────────────────────────────────────────────────────
async function handleEscalate(interaction) {
  const ticket = ticketStore.getOrHydrate(interaction.channel, config);
  if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', ephemeral: true });
  if (!canActOnTicket(interaction.member, ticket))
    return interaction.reply({ content: 'You do not have permission to escalate this ticket.', ephemeral: true });
  if (ticket.escalated)
    return interaction.reply({ content: 'This ticket has already been escalated.', ephemeral: true });

  ticketStore.update(interaction.channel.id, { escalated: true });

  try {
    const components = cloneComponents(interaction.message);
    swapButton(components, IDS.ESCALATE_BTN, IDS.ESCALATE_USED_BTN, 'Escalated', 2);
    disableButton(components, IDS.ESCALATE_USED_BTN);
    await interaction.message.edit({ components });
  } catch (_) {}

  const pingRole = ESCALATE_ROLE[ticket.type] ?? ESCALATE_ROLE.general;

  return interaction.reply({
    content:         `<@&${pingRole}>, ${interaction.user} has escalated this ticket. Please assist and resolve this ticket.`,
    allowedMentions: { roles: [pingRole] },
  });
}

// ─── Main router ──────────────────────────────────────────────────────────────
async function handle(interaction, client) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === IDS.SUPPORT_SELECT) return handleSupportSelect(interaction);
    if (interaction.customId === IDS.IA_TYPE_SELECT)  return handleIATypeSelect(interaction);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === IDS.GENERAL_MODAL)      return handleGeneralModalSubmit(interaction, client);
    if (interaction.customId === IDS.IA_OTHER_MODAL)     return handleIAOtherModalSubmit(interaction, client);
    if (interaction.customId === IDS.IA_DEPUTY_MODAL)    return handleIADeputyModalSubmit(interaction, client);
    if (interaction.customId === IDS.CLOSE_REASON_MODAL) return handleCloseReasonModal(interaction, client);
  }

  if (interaction.isButton()) {
    if (interaction.customId === IDS.CLAIM_BTN)         return handleClaim(interaction);
    if (interaction.customId === IDS.UNCLAIM_BTN)       return handleUnclaim(interaction);
    if (interaction.customId === IDS.CLOSE_BTN)         return handleCloseButton(interaction);
    if (interaction.customId === IDS.CLOSE_CONFIRM_BTN) return handleCloseConfirm(interaction, client);
    if (interaction.customId === IDS.CLOSE_CANCEL_BTN)  return handleCloseCancel(interaction);
    if (interaction.customId === IDS.ESCALATE_BTN)      return handleEscalate(interaction);
  }
}

module.exports = { handle, IDS };
