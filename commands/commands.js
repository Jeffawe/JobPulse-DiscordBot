import dotenv from 'dotenv';
import { connectDB } from "../db/db.js";
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';

dotenv.config();

export const setupBot = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the bot on this Channel')
        .addStringOption(option =>
            option.setName('email')
                .setDescription('Enter your registered email')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const email = interaction.options.getString('email');
            const discordId = interaction.user.id;
            const guildId = interaction.guildId;
            const channel = interaction.channel;

            if (!channel) {
                return interaction.reply({ content: 'Error: Could not retrieve the channel.', ephemeral: true });
            }

            if (!channel.permissionsFor(interaction.client.user.id).has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ 
                    content: 'I need the `MANAGE_CHANNELS` permission to modify channel settings.',
                    flags: { ephemeral: true } 
                  });
            }

            // Connect to the DB
            const db = await connectDB();

            const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

            if (!user) {
                await interaction.reply({ content: "Email not found. Please register first.", ephemeral: true });
                return;
            }

            const webhook = (user.discord_webhook)
                ? user.discord_webhook
                : await createChannelWebhook(channel) ?? "NULL";

            await db.run('UPDATE users SET discord_id = ?, guild_id = ?, discord_webhook = ? WHERE email = ?',
                [discordId, guildId, webhook, email]);

            await interaction.reply('Bot successfully set up and linked to your account!');
        } catch (error) {
            console.error('Error executing setup command:', error);
            await interaction.reply({ content: 'There was an error setting up the bot!', ephemeral: true });
            return;
        }

    }
};

export const pollEmailCommand = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Poll for new emails'),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const guildId = interaction.guildId;
        const db = await connectDB();

        const user = await db.get('SELECT * FROM users WHERE discord_id = ? AND guild_id = ?', [discordId, guildId]);

        if (!user) {
            await interaction.reply({ content: "User not found. Please register first.", ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            await pollData(user.id);
            // Use editReply instead of reply for the success message
            await interaction.editReply('✅ Successfully polled emails');
        } catch (error) {
            console.error('Error polling emails:', error);
            // Use editReply for error messages too
            await interaction.editReply(`❌ Failed to poll emails`);
        }
    }
};

export const migrateEmailCommand = {
    data: new SlashCommandBuilder()
        .setName('migrate-emails')
        .setDescription('Migrate Existing Emails to the new label'),   

    async execute(interaction) {
        const discordId = interaction.user.id;
        const guildId = interaction.guildId;
        const db = await connectDB();

        const user = await db.get('SELECT * FROM users WHERE discord_id = ? AND guild_id = ?', [discordId, guildId]);

        if (!user) {
            await interaction.reply({ content: "User not found. Please register first.", ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            await migrateData(user.id);
            // Use editReply instead of reply for the success message
            await interaction.editReply('✅ Successfully migrated emails');
        } catch (error) {
            console.error('Error polling emails:', error);
            // Use editReply for error messages too
            await interaction.editReply(`❌ Failed to migrate emails`);
        }
    }
};

const createChannelWebhook = async (channel) => {
    if (!channel.manageable) {
        console.log('Bot does not have permission to manage this channel.');
        return;
    }
    try {
        const webhook = await channel.createWebhook({
            name: 'Job Pulse Webhook',
        });

        console.log(`Created webhook ${webhook.name} at URL: ${webhook.url}`);
        return webhook.url;
    } catch (error) {
        console.error('Error creating webhook:', error);
    }
}

const pollData = async (id) => {
    try {
        const response = await fetch(`${process.env.BACKEND_URL}/job/poll-emails`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'userid': id
            }
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData}`);
        }
        
        return await response.json();
    } catch (error) {
        // Throw a more informative error
        throw new Error(`Failed to poll emails: ${error.message}`);
    }
};

const migrateData = async (id) => {
    try {
        const response = await fetch(`${process.env.BACKEND_URL}/job/migrate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'userid': id
            }
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData}`);
        }
        
        return await response.json();
    } catch (error) {
        // Throw a more informative error
        throw new Error(`Failed to poll emails: ${error.message}`);
    }
};