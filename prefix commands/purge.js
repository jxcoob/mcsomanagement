module.exports = {
  name: 'purge',
  async execute(message, args) {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('Please provide a number between 1 and 100.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    await message.delete().catch(() => {});
    const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
    const notice = await message.channel.send(`Deleted **${deleted ? deleted.size : 0}** message(s).`);
    setTimeout(() => notice.delete().catch(() => {}), 4000);
  },
};
