const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require('discord.js');

// ── Training Config ────────────────────────────────────────
const TRAINING_CONFIG = {
  pingRole:     '1498131736406659105',
  commandRoles: [
    '1498131736478089264',
    '1498131737623007374',
  ],
  channel: '1503190027499339948',
};

// ── In-memory store for active training votes ──────────────
const activeVotes = new Map();

// ── Helper: check if member has a permitted command role ───
function hasTrainingPermission(member) {
  return TRAINING_CONFIG.commandRoles.some(roleId =>
    member.roles.cache.has(roleId)
  );
}

// ── Helper: build a training container (Components V2) ────
function buildTrainingContainer(text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(text)
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('training')
    .setDescription('MCSO training commands')
    .addSubcommand(sub =>
      sub
        .setName('vote')
        .setDescription('Initiate a training vote')
        .addIntegerOption(opt =>
          opt
            .setName('votes_required')
            .setDescription('How many attendance votes are required to start the training')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(opt =>
          opt
            .setName('minutes')
            .setDescription('In how many minutes will this training commence?')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End the current training')
    ),

  async execute(interaction) {
    if (!hasTrainingPermission(interaction.member)) {
      return interaction.reply({
        content: 'Permission denied.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ── /training vote ────────────────────────────────────
    if (sub === 'vote') {
      const votesRequired = interaction.options.getInteger('votes_required');
      const minutes = interaction.options.getInteger('minutes');
      const startTimestamp = Math.floor(Date.now() / 1000) + minutes * 60;
      const durationMs = minutes * 60 * 1000;

      const channel = interaction.guild.channels.cache.get(TRAINING_CONFIG.channel);
      if (!channel) {
        return interaction.reply({ content: 'Training channel not found. Contact MCSO Command.', ephemeral: true });
      }

      const voteText =
        `## MCSO — training Vote\n` +
        `A training vote has been initiated. All cadets that are available to attend may mark their attendance below. Failure to join the training after marking your attendance will result in disciplinary action.\n\n` +
        `**Votes Required:** ${votesRequired}\n\n` +
        `This training will commence <t:${startTimestamp}:R>`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('training_attend')
          .setLabel('Mark Attendance')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('training_view')
          .setLabel('View Attendance')
          .setStyle(ButtonStyle.Secondary),
      );

      const voteContainer = buildTrainingContainer(voteText);
      voteContainer.spliceComponents(0, 0, new TextDisplayBuilder().setContent(`<@&${TRAINING_CONFIG.pingRole}>`));

      const message = await channel.send({
        components: [voteContainer, row],
        flags: MessageFlags.IsComponentsV2,
      });

      activeVotes.set(message.id, {
        attendees: new Set(),
        votesRequired,
        startTimestamp,
        channelId: channel.id,
        messageId: message.id,
      });

      // ── Button Collector — runs for the full duration ───
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: durationMs,
      });

      collector.on('collect', async i => {
        const voteData = activeVotes.get(message.id);
        if (!voteData) return;

        // Mark Attendance
        if (i.customId === 'training_attend') {
          if (voteData.attendees.has(i.user.id)) {
            const removeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('training_remove_confirm')
                .setLabel('Remove Attendance')
                .setStyle(ButtonStyle.Danger),
            );

            const removeReply = await i.reply({
              content: `You've already marked yourself attending to this training, would you like to remove your attendance?`,
              components: [removeRow],
              ephemeral: true,
              fetchReply: true,
            });

            const removeCollector = removeReply.createMessageComponentCollector({
              componentType: ComponentType.Button,
              time: 60_000,
              max: 1,
            });

            removeCollector.on('collect', async removeInteraction => {
              if (removeInteraction.customId !== 'training_remove_confirm') return;

              const voteDataNow = activeVotes.get(message.id);
              if (!voteDataNow) {
                await removeInteraction.update({ content: 'This training vote is no longer active.', components: [] });
                return;
              }

              if (!voteDataNow.attendees.has(i.user.id)) {
                await removeInteraction.update({ content: 'You are not currently marked as attending.', components: [] });
                return;
              }

              voteDataNow.attendees.delete(i.user.id);

              const updatedText =
                `## MCSO — training Vote\n` +
                `A training vote has been initiated. All cadets that are available to attend may mark their attendance below. Failure to join the training after marking your attendance will result in disciplinary action.\n\n` +
                `**Votes Required:** ${voteDataNow.votesRequired}\n` +
                `**Current Votes:** ${voteDataNow.attendees.size}/${voteDataNow.votesRequired}\n\n` +
                `This training will commence <t:${voteDataNow.startTimestamp}:R>`;

              await message.edit({
                components: [buildTrainingContainer(updatedText), row],
                flags: MessageFlags.IsComponentsV2,
              }).catch(() => {});
              await removeInteraction.update({ content: 'Your attendance has been removed.', components: [] });
            });

            removeCollector.on('end', (collected, reason) => {
              if (reason === 'time' && collected.size === 0) {
                i.editReply({ content: 'Remove request timed out.', components: [] }).catch(() => {});
              }
            });

            return;
          }

          voteData.attendees.add(i.user.id);
          await i.reply({ content: 'Attendance successfully marked.', ephemeral: true });

          const updatedText =
            `## MCSO — training Vote\n` +
            `A training vote has been initiated. All cadets that are available to attend may mark their attendance below. Failure to join the training after marking your attendance will result in disciplinary action.\n\n` +
            `**Votes Required:** ${voteData.votesRequired}\n` +
            `**Current Votes:** ${voteData.attendees.size}/${voteData.votesRequired}\n\n` +
            `This training will commence <t:${voteData.startTimestamp}:R>`;

          await message.edit({
            components: [buildTrainingContainer(updatedText), row],
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        // View Attendance
        if (i.customId === 'training_view') {
          const list = voteData.attendees.size > 0
            ? [...voteData.attendees].map(id => `<@${id}>`).join('\n')
            : '_No cadets have marked attendance yet._';

          await i.reply({
            content: `**Attendance List (${voteData.attendees.size}/${voteData.votesRequired})**\n${list}`,
            ephemeral: true,
          });
        }
      });

      // ── When timer expires: start or cancel ────────────
      collector.on('end', async () => {
        await message.delete().catch(() => {});

        const voteData = activeVotes.get(message.id);
        if (!voteData) return;

        activeVotes.delete(message.id);

        if (voteData.attendees.size >= voteData.votesRequired) {
          await triggerTrainingStart(interaction.guild, voteData, channel);
        } else {
          const cancelText =
            `## MCSO — training Cancelled\n` +
            `An insufficient amount of votes for the previous training has caused it to be cancelled. You will be notified for the next training vote when/if started.`;

          await channel.send({
            components: [buildTrainingContainer(cancelText)],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      });

      await interaction.reply({ content: `training vote sent to <#${channel.id}>.`, ephemeral: true });
    }

    // ── /training end ─────────────────────────────────────
    if (sub === 'end') {
      const channel = interaction.guild.channels.cache.get(TRAINING_CONFIG.channel);
      if (!channel) {
        return interaction.reply({ content: 'Training channel not found. Contact MCSO Command.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      let deleted = 0;
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      while (true) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        const deletable = fetched.filter(m => !m.pinned);

        if (deletable.size === 0) break;

        const bulkDeletable = deletable.filter(m => m.createdTimestamp > twoWeeksAgo);
        const tooOld = deletable.filter(m => m.createdTimestamp <= twoWeeksAgo);

        if (bulkDeletable.size >= 2) {
          const result = await channel.bulkDelete(bulkDeletable, true);
          deleted += result.size;
        } else if (bulkDeletable.size === 1) {
          await bulkDeletable.first().delete().catch(() => {});
          deleted++;
        }

        for (const msg of tooOld.values()) {
          await msg.delete().catch(() => {});
          deleted++;
        }

        if (fetched.size < 100) break;
      }

      const endText =
        `## MCSO — training Ended\n` +
        `The recent training has now concluded. If you missed this one, don't worry, trainings are hosted regularly throughout the week and you'll be notified of the next one. Thank you to all cadets who attended the recent training.`;

      await channel.send({
        components: [buildTrainingContainer(endText)],
        flags: MessageFlags.IsComponentsV2,
      });
      await interaction.editReply({ content: `training ended.` });
    }
  },
};

// ── Trigger training Started embed ──────────────────────
async function triggerTrainingStart(guild, voteData, channel) {
  const attendeeMentions = [...voteData.attendees].map(id => `<@${id}>`).join(' ');

  const startText =
    `## MCSO — training Started\n` +
    `A training has now commenced. All cadets who marked their attendance to the training vote are now required to attend. Additional cadets may still join but must be in-game within 5 minutes.\n\n` +
    `Upon joining in-game, put on the Class A uniform, spawning in the Falcon Interceptor Utility 2024 with the MCSO server saved preset. Once spawned in, ensure that you have an M4A1 (within your trunk), a taser, pepperspray/OC bottle, beanbag shotgun (within your trunk), handcuffs, baton, duty belt, citation book, and a Glock 17. Once all gear is obtained, head down to the briefing room for future instructions from command.`;

  const startContainer = buildTrainingContainer(startText);
  startContainer.spliceComponents(0, 0, new TextDisplayBuilder().setContent(attendeeMentions));

  await channel.send({
    components: [startContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}