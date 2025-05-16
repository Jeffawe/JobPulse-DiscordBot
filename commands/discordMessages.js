export const fetchDiscordMessages = async ({ date, page = 1, limit = 10, channelId }) => {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error('Bot token not set');
  }

  if (!channelId) {
    throw new Error('Channel ID not set');
  }

  const beforeTimestamp = new Date(date).getTime();
  let fetchUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;

  let fetched = [];
  let done = false;
  let iterations = 0;
  const maxIterations = 10;

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

    for (const msg of batch) {
      const msgDate = new Date(msg.timestamp).getTime();

      // Stop fetching older messages if past date
      if (msgDate < beforeTimestamp) {
        done = true;
        break;
      }

      // Filter: Only include messages that look like job update embeds
      const embed = msg.embeds?.[0];
      const isJobUpdate =
        embed &&
        embed.title?.startsWith("Job Update:") &&
        embed.fields?.some(f => f.name === "Status");

      if (isJobUpdate) {
        fetched.push(msg);
      }
    }

    const lastMsgId = batch[batch.length - 1]?.id;
    fetchUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100&before=${lastMsgId}`;
    iterations++;
  }

  // Sort and paginate
  fetched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
