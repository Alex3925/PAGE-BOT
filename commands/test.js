const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const sessionIds = [
  "ba1a5c15-867a-4caa-b91d-d5ef01503aeb", "448379a9-521d-4a50-9c9a-47e7a9b0227b",
  "6417e57c-ac9f-4b8c-b3bd-1b03c0ddbd49", "07ac79aa-177c-4ed9-a5cd-fa87bda63831",
  "e10a6247-623f-4337-8cd0-bc98972c487f", "fc053908-a0f3-4a9c-ad4a-008105dcc360",
  "a14da8a4-6566-45bd-b589-0f3dff2a1779"
];
let sessionIndex = 0;
const getNextSessionId = () => sessionIds[sessionIndex++ % sessionIds.length];

const getImageUrl = async (event, token, cache) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  try {
    const { data } = mid && await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    return data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url;
  } catch {
    const cached = cache?.get(event.sender.id);
    return cached && Date.now() - cached.timestamp < 300000 ? cached.url : null;
  }
};

const conversationHistory = {};
const MAX_HISTORY = 20;

const chunkText = (text, size = 1900) => text.match(new RegExp(`.{1,${size}}`, 'gs')) || [];

module.exports = {
  name: 'test',
  description: 'Chat with Mocha AI, optionally with image.',
  usage: 'ask a question',
  author: 'coffee',

  async execute(senderId, args, token, event, send, cache) {
    const prompt = args.join(' ').trim() || 'Hello';
    const image = await getImageUrl(event, token, cache);
    const content = image ? `${prompt}\n\nImage URL: ${image}` : prompt;
    const chatSessionId = getNextSessionId();

    conversationHistory[senderId] = (conversationHistory[senderId] || []).slice(-MAX_HISTORY);
    conversationHistory[senderId].push({ role: 'user', content });

    const headers = {
      'content-type': 'application/json',
      origin: 'https://digitalprotg-32922.chipp.ai',
      referer: 'https://digitalprotg-32922.chipp.ai/w/chat/',
      cookie: '__Host-next-auth.csrf-token=4723c7d0081a66dd0b572f5e85f5b40c2543881365782b6dcca3ef7eabdc33d6%7C06adf96c05173095abb983f9138b5e7ee281721e3935222c8b369c71c8e6536b; __Secure-next-auth.callback-url=https%3A%2F%2Fapp.chipp.ai; userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5; correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8'
    };

    try {
      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", {
        chatSessionId,
        messages: conversationHistory[senderId]
      }, { headers });

      const result = typeof data === 'string' ? data : JSON.stringify(data);
      const matches = [...result.matchAll(/0:"(.*?)"/g)].map(m => m[1]) || [];
      const reply = matches.join('').replace(/\\n/g, '\n');

      const tools = data.choices?.[0]?.message?.toolInvocations || [];
      conversationHistory[senderId].push({ role: 'assistant', content: reply });

      for (const tool of tools) {
        if (tool.toolName === 'generateImage' && tool.state === 'result') {
          return send(senderId, { text: `🖼️ Generated Image:\n${tool.result}` }, token);
        }
        if (tool.toolName === 'browseWeb' && tool.state === 'result') {
          const info = tool.result.answerBox?.answer ||
            tool.result.organic?.map(o => o.snippet).join('\n\n') || 'No info found.';
          return send(senderId, {
            text: `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${reply}\n\nBrowse result:\n${info}\n・──── >ᴗ< ────・`
          }, token);
        }
      }

      if (!reply) throw new Error("Empty AI response.");
      for (const chunk of chunkText(`💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${reply}\n・──── >ᴗ< ────・`)) {
        await send(senderId, { text: chunk }, token);
      }

    } catch (e) {
      console.error("AI Error:", e?.response?.data || e.message);
      await send(senderId, { text: '❎ | An error occurred. Please try again later.' }, token);
    }
  }
};