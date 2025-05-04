import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, Collection } from 'discord.js';
import { setupBot, pollEmailCommand } from './commands/commands.js';
import express from 'express';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_SECRET = process.env.BOT_SECRET;

app.use(express.json());

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
//client.commands.set(migrateEmailCommand.data.name, migrateEmailCommand);

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

async function getChannelIdFromWebhook(webhookUrl) {
  // Extract webhook ID and token from URL
  const urlParts = webhookUrl.split('/');
  const webhookId = urlParts[urlParts.length - 2];
  const webhookToken = urlParts[urlParts.length - 1];
  
  // Use Discord API to fetch webhook info
  const response = await fetch(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}`);
  const webhookData = await response.json();
  
  return webhookData.channel_id;
}

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

app.post('/updateMessages', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${BOT_SECRET}`) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = req.body; // Array of updates
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Expected an array of updates' });
    }

    const results = [];

    for (const update of updates) {
      const { discord_msg_id, discord_webhook, jobStatus, date } = update;
      
      if (!discord_msg_id || !discord_webhook) {
        results.push({ success: false, error: 'Missing required fields' });
        continue;
      }
      
      try {
        // Get channel ID from webhook URL
        const channelId = await getChannelIdFromWebhook(discord_webhook);
        
        // Get the channel and message
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(discord_msg_id);
        
        // Get current embed data to preserve other fields
        const currentEmbed = message.embeds[0]?.data || {};
        
        // Create updated embed preserving original content
        const updatedEmbed = new EmbedBuilder()
          .setTitle(currentEmbed.title || 'Job Update')
          .setColor(currentEmbed.color || 5814783);
        
        // Preserve description if it exists
        if (currentEmbed.description) {
          updatedEmbed.setDescription(currentEmbed.description);
        }
        
        // Process existing fields, updating only Status and Date
        const updatedFields = [];
        let hasStatusField = false;
        let hasDateField = false;
        
        if (currentEmbed.fields) {
          currentEmbed.fields.forEach(field => {
            if (field.name === 'Status') {
              updatedFields.push({
                name: 'Status',
                value: jobStatus || field.value || 'Unknown',
                inline: field.inline
              });
              hasStatusField = true;
            }
            else if (field.name === 'Date') {
              updatedFields.push({
                name: 'Date',
                value: date ? new Date(date).toLocaleString() : field.value || 'Unknown',
                inline: field.inline
              });
              hasDateField = true;
            }
            else {
              // Preserve all other fields exactly as they are
              updatedFields.push(field);
            }
          });
        }
        
        // Add Status field if it didn't exist before
        if (!hasStatusField && jobStatus) {
          updatedFields.push({
            name: 'Status',
            value: jobStatus,
            inline: true
          });
        }
        
        // Add Date field if it didn't exist before
        if (!hasDateField && date) {
          updatedFields.push({
            name: 'Date',
            value: new Date(date).toLocaleString(),
            inline: true
          });
        }
        
        // Add all fields to the embed
        updatedEmbed.addFields(updatedFields);
        
        // Preserve footer
        if (currentEmbed.footer) {
          updatedEmbed.setFooter({
            text: currentEmbed.footer.text || 'Job Application Tracker',
            iconURL: currentEmbed.footer.icon_url
          });
        } else {
          updatedEmbed.setFooter({ text: 'Job Application Tracker' });
        }
        
        // Update the message
        await message.edit({ embeds: [updatedEmbed] });
        results.push({ 
          success: true, 
          messageId: discord_msg_id, 
          channelId: channelId 
        });
      } catch (err) {
        console.error(`Failed to update message ${discord_msg_id}:`, err);
        results.push({ 
          success: false, 
          error: err.message, 
          messageId: discord_msg_id 
        });
      }
    }

    res.status(200).json({ results });
  } catch (err) {
    console.error('Error in /updateMessages:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Discord bot listening on port ${PORT}`);
});