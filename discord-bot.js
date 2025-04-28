import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, Collection } from 'discord.js';
import { setupBot, pollEmailCommand } from './commands/commands.js';

dotenv.config();

// Create a new client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Collection to store slash commands
client.commands = new Collection();

// Define a basic ping command
const pingCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  }
};

// Define an echo command that takes a parameter
const echoCommand = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echoes your input')
    .addStringOption(option => 
      option.setName('message')
        .setDescription('The message to echo')
        .setRequired(true)),
  async execute(interaction) {
    const message = interaction.options.getString('message');
    await interaction.reply(`You said: ${message}`);
  }
};

// Store commands in the collection
client.commands.set(setupBot.data.name, setupBot);
client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(echoCommand.data.name, echoCommand);
client.commands.set(pollEmailCommand.data.name, pollEmailCommand);

// Event handler when bot is ready
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  
  // Deploy slash commands
  registerCommands();
});

// Handle interactions (slash commands)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ 
      content: 'There was an error executing this command!', 
      ephemeral: true 
    });
  }
});

// Handle message events
client.on(Events.MessageCreate, message => {
  // Ignore messages from bots
  if (message.author.bot) return;
  
  console.log(`Message received from ${message.author.username}: ${message.content}`);
  
  // Example of responding to a specific message
  if (message.content.toLowerCase() === 'hello bot') {
    message.channel.send('Hello there!');
  }
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    // Get the general or welcome channel (you can choose any channel for instructions)
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.type === 'general'); 

    console.log(channel);
    if (!channel) return;

    // Send an introductory message with setup instructions
    const instructionsMessage = `
      **Thank you for adding me to your server! 🎉**

      Before you can use slash commands, please ensure that I have the **\`USE_SLASH_COMMANDS\`** permission in the channel where you want to use the commands.

      **Instructions to enable Slash Commands:**
      1. Go to your server settings.
      2. Select the channel where you want the bot to work.
      3. Click on **Server Settings** → **Integrations**.
      4. Under **Bots/Apps**, click on **Manage** and go to **Commands**
      5. Click on the /setup command. Add Channels and select the channel where you want the bot to work.
      6. Save the changes.

      Once you’ve set that up, you can start using my slash commands in this channel!

      If you need any help, feel free to contact support or check the bot’s documentation.
    `;

    // Send the message with instructions
    await channel.send(instructionsMessage);
  } catch (error) {
    console.error('Error sending setup instructions:', error);
  }
});

// Function to register slash commands with Discord
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const commandsData = Array.from(client.commands.values()).map(command => command.data.toJSON());
  
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commandsData },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);