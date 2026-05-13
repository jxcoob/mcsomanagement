const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');
const keep_alive = require('./keep_alive.js')
const ticketHandler  = require('./handlers/handler');
const prefixCommands = require('./prefix');

// ── Create client ──────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Load slash commands ────────────────────────────────────
client.slashCommands = new Collection();
const slashPath = path.join(__dirname, 'slash commands');
for (const file of fs.readdirSync(slashPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(slashPath, file));
  if (cmd.data && cmd.execute) {
    client.slashCommands.set(cmd.data.name, cmd);
    console.log(`[Slash] Loaded: /${cmd.data.name}`);
  }
}

// ── Load prefix commands ───────────────────────────────────
client.prefixCommands = new Collection();
const prefixPath = path.join(__dirname, 'prefix commands');
const ignoredFiles = ['util.js', 'store.js'];
for (const file of fs.readdirSync(prefixPath).filter(f => f.endsWith('.js') && !ignoredFiles.includes(f))) {
  const cmd = require(path.join(prefixPath, file));
  if (cmd.name && cmd.execute) {
    client.prefixCommands.set(cmd.name, cmd);
    console.log(`[Prefix] Loaded: -${cmd.name}`);
  }
}

// ── Register slash commands on startup ────────────────────
async function registerCommands() {
  const commandData = [...client.slashCommands.values()].map(c => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log(`\nRegistering ${commandData.length} slash command(s)...`);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commandData });
    console.log('Slash commands registered.\n');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

// ── Ready ──────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`\nOnline as ${client.user.tag}`);
  console.log(`Missoula County Sheriffs Office`);
  await registerCommands();
});

// ── Slash command handler ──────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Error] /${interaction.commandName}:`, err);
    const msg = { content: 'An error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

// ── Prefix command handler ─────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;
  if (!message.member?.roles.cache.has(config.roles.prefixCommandRole)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.prefixCommands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`[Error] -${commandName}:`, err);
    message.reply('An error occurred.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
  }
});

// Ticket handler
client.on('interactionCreate', interaction => ticketHandler.handle(interaction, client));
client.on('messageCreate',     message    => prefixCommands.handle(message));

// ── Login ──────────────────────────────────────────────────
client.login(config.token);
