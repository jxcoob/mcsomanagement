/**
 * prefix/sendpanel.js
 * Command: -sendpanel
 * Sends the BCSO support panel into the configured channel.
 * Restricted to role: 1498131737623007374
 */

'use strict';

const PANEL_CHANNEL_ID  = '1498131740697301196';
const COMMAND_ROLE_ID   = '1498131737623007374';

const BANNER_URL       = 'https://cdn.discordapp.com/attachments/1498131738671452268/1504217842243862609/FTD_application.png?ex=6a062f88&is=6a04de08&hm=353c0b0b3ef13ceea600d0b407e7359b8576522b47e690dd500bf76ca0e6adaa&animated=true&';
const BANNER_PROXY_URL = 'https://media.discordapp.net/attachments/1498131738671452268/1504217842243862609/FTD_application.png?ex=6a062f88&is=6a04de08&hm=353c0b0b3ef13ceea600d0b407e7359b8576522b47e690dd500bf76ca0e6adaa&';
const FOOTER_URL       = 'https://cdn.discordapp.com/attachments/1498131738671452268/1502424978421973063/CADET_TRAINING.png?ex=6a05988c&is=6a04470c&hm=120b1d867136a218f89f4394d15dec9de30870b7eaf1d21c8ae9cbcb148eb1a0&animated=true&';
const FOOTER_PROXY_URL = 'https://media.discordapp.net/attachments/1498131738671452268/1502424978421973063/CADET_TRAINING.png?ex=6a05988c&is=6a04470c&hm=120b1d867136a218f89f4394d15dec9de30870b7eaf1d21c8ae9cbcb148eb1a0&';

function buildPanelPayload() {
  return {
    flags:           1 << 15,
    allowedMentions: { parse: [] },
    components: [
      {
        id:           1,
        type:         17,
        accent_color: null,
        spoiler:      false,
        components: [
          {
            id:   2,
            type: 12,
            items: [{
              media: {
                url:          BANNER_URL,
                proxy_url:    BANNER_PROXY_URL,
                width:        1254,
                height:       333,
                content_type: 'image/webp',
              },
              description: null,
              spoiler:     false,
            }],
          },
          { id: 3, type: 14, divider: true, spacing: 2 },
          {
            id:      4,
            type:    10,
            content: "## Missoula County Sheriff's Office Support\n\n> Welcome to the MCSO support panel. Here you will be able to create support tickets for anything you may need support with. Before creating a support ticket, we ask to please read below to be informed on what type of ticket you should open for your issue.\n\n❓ **General Support Ticket**\n\n> A general support ticket is used for any inquires, questions, or concerns you may have. We ask you to please check the information channel before creating this type of ticket to ensure you won't ask a question that can be resolved by simply checking the information channel.\n\n📝 **Internal Affairs Support Ticket**\n\n> An internal affairs support ticket (IA Ticket) is used for deputy reports, or anything that requires the assistance of the command team+. Before making a report, please ensure it is reasonable as petty reports will be ignored.",
          },
          { id: 5, type: 14, divider: true, spacing: 1 },
          {
            id:   6,
            type: 12,
            items: [{
              media: {
                url:          FOOTER_URL,
                proxy_url:    FOOTER_PROXY_URL,
                width:        1254,
                height:       100,
                content_type: 'image/png',
              },
              description: null,
              spoiler:     false,
            }],
          },
        ],
      },
      {
        type:       1,
        components: [{
          type:        3,
          custom_id:   'p_301821495703769089',
          placeholder: 'Select a ticket type.',
          min_values:  1,
          max_values:  1,
          options: [
            { label: 'General Support',          value: 'TijUetP4eh', emoji: { name: '❓' } },
            { label: 'Internal Affairs Support', value: 'LrsOU5WLvy', emoji: { name: '📝' } },
          ],
        }],
      },
    ],
  };
}

module.exports = {
  name: 'sendpanel',
  async execute(message) {
    if (!message.member.roles.cache.has(COMMAND_ROLE_ID)) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    let targetChannel;
    try {
      targetChannel = await message.client.channels.fetch(PANEL_CHANNEL_ID);
    } catch {
      return message.reply({ content: `Could not find the panel channel (<#${PANEL_CHANNEL_ID}>).` });
    }

    try {
      await targetChannel.send(buildPanelPayload());
      return message.reply({ content: `✅ Support panel sent to <#${PANEL_CHANNEL_ID}>.` });
    } catch (err) {
      console.error('[BCSO] Failed to send panel:', err);
      return message.reply({ content: 'Failed to send the panel. Check bot permissions in that channel.' });
    }
  },
};
