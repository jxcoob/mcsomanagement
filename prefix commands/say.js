module.exports = {
  name: 'say',
  async execute(message, args) {
    if (!args.length) {
      return message.reply('Usage: `-say <text>`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    await message.delete().catch(() => {});
    await message.channel.send(args.join(' '));
  },
};
