function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
  name: 'ping',
  async execute(message, args) {
    const sent = await message.reply('Pinging…');
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const ws = message.client.ws.ping;
    await sent.edit(
      `🏓 **Pong!**\n` +
      `> **Roundtrip latency:** ${roundtrip}ms\n` +
      `> **WebSocket heartbeat:** ${ws}ms\n` +
      `> **Uptime:** ${formatUptime(message.client.uptime)}`
    );
  },
};
