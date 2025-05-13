import fetch from 'node-fetch';

const DISCORD_BOT_TOKEN = process.env.DISCORD_TOKEN;

// Fetch messages from a Discord channel
export const fetchDiscordMessages = async ({ date, page = 1, limit = 10, channelId }) => {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error('Bot token not set');
  }

  if(!channelId) {
    throw new Error('Channel ID not set');
  }

  const DISCORD_CHANNEL_ID = channelId;
  const beforeTimestamp = new Date(date).getTime();

  let messages = [];
  let fetchUrl = `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=100`;

  let fetched = [];
  let done = false;
  let iterations = 0;
  const maxIterations = 10; // up to 1000 messages max to prevent overload

  while (!done && iterations < maxIterations) {
    const res = await fetch(fetchUrl, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`
      }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to fetch messages: ${error}`);
    }

    const batch = await res.json();
    if (batch.length === 0) break;

    // Filter by date
    for (const msg of batch) {
      const msgDate = new Date(msg.timestamp).getTime();
      if (msgDate >= beforeTimestamp) {
        fetched.push(msg);
      } else {
        done = true;
        break;
      }
    }

    const lastMsgId = batch[batch.length - 1]?.id;
    fetchUrl = `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=100&before=${lastMsgId}`;
    iterations++;
  }

  // Sort by date descending
  fetched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Pagination
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    page,
    total: fetched.length,
    totalPages: Math.ceil(fetched.length / limit),
    messages: fetched.slice(start, end).map(msg => ({
      id: msg.id,
      content: msg.content,
      embeds: msg.embeds,
      timestamp: msg.timestamp
    }))
  };
};
