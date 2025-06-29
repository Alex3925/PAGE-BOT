const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const getImageUrl = async (event, token, cache) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (mid) {
    try {
      const res = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
        params: { access_token: token }
      });
      return res.data?.data?.[0]?.image_data?.url ?? res.data?.data?.[0]?.file_url;
    } catch (e) {
      console.warn("Image fetch error:", e?.response?.data || e.message);
    }
  }
  const c = cache?.get(event.sender.id);
  return c && Date.now() - c.timestamp < 300000 ? c.url : null;
};

const sessionIds = [
  "ba1a5c15-867a-4caa-b91d-d5ef01503aeb",
  "448379a9-521d-4a50-9c9a-47e7a9b0227b",
  "6417e57c-ac9f-4b8c-b3bd-1b03c0ddbd49",
  "07ac79aa-177c-4ed9-a5cd-fa87bda63831",
  "e10a6247-623f-4337-8cd0-bc98972c487f",
  "fc053908-a0f3-4a9c-ad4a-008105dcc360",
  "a14da8a4-6566-45bd-b589-0f3dff2a1779"
];
let sessionIndex = 0;

const getNextSessionId = () => {
  const id = sessionIds[sessionIndex];
  sessionIndex = (sessionIndex + 1) % sessionIds.length;
  return id;
};

const chunkMessage = (text, max = 1900) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += max) {
    chunks.push(text.slice(i, i + max));
  }
  return chunks;
};

const conversationHistory = {};
const MAX_HISTORY = 20;
const KEEP_RECENT = 12;

module.exports = {
  name: 'ai',
  description: 'Interact with Mocha AI using text queries.',
  usage: 'ask a question, optionally with image',
  author: 'coffee',

  async execute(senderId, args, pageAccessToken, event, sendMessage, imageCache) {
    const rawPrompt = args.join(' ').trim() || 'Hello';
    const chatSessionId = getNextSessionId();

    const imageUrl = await getImageUrl(event, pageAccessToken, imageCache);
    const prompt = imageUrl ? `${rawPrompt}\n\nImage URL: ${imageUrl}` : rawPrompt;

    const headers = {
      'content-type': 'application/json',
      'origin': 'https://digitalprotg-32922.chipp.ai',
      'referer': 'https://digitalprotg-32922.chipp.ai/w/chat/',
      'cookie': '__Host-next-auth.csrf-token=4723c7d0081a66dd0b572f5e85f5b40c2543881365782b6dcca3ef7eabdc33d6%7C06adf96c05173095abb983f9138b5e7ee281721e3935222c8b369c71c8e6536b; __Secure-next-auth.callback-url=https%3A%2F%2Fapp.chipp.ai; userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5; correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8'
    };

    try {
      if (!conversationHistory[senderId]) conversationHistory[senderId] = [];
      if (conversationHistory[senderId].length > MAX_HISTORY) {
        conversationHistory[senderId] = conversationHistory[senderId].slice(-KEEP_RECENT);
      }

      conversationHistory[senderId].push({ role: 'user', content: prompt });

      const payload = {
        chatSessionId,
        messages: conversationHistory[senderId]
      };

      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", payload, { headers });

      const textData = typeof data === 'string' ? data : JSON.stringify(data);
      const responseTextChunks = textData.match(/"result":"(.*?)"/g)?.map(c => c.slice(10, -1).replace(/\\n/g, '\n')) ||
                                 textData.match(/0:"(.*?)"/g)?.map(c => c.slice(3, -1).replace(/\\n/g, '\n')) || [];

      const fullResponseText = responseTextChunks.join('');
      const toolCalls = data.choices?.[0]?.message?.toolInvocations || [];

      if (fullResponseText) {
        conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });
      }

      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `🖼️ Generated Image:\n${toolCall.result}` }, pageAccessToken);
          return;
        }

        if (toolCall.toolName === 'browseWeb' && toolCall.state === 'result' && toolCall.result) {
          const snippets = toolCall.result.answerBox?.answer ||
            toolCall.result.organic?.map(o => o.snippet).filter(Boolean).join('\n\n') || 'No relevant info found.';
          const finalReply = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fullResponseText}\n\nBrowse result:\n${snippets}\n・──── >ᴗ< ────・`;
          await sendMessage(senderId, { text: finalReply }, pageAccessToken);
          return;
        }
      }

      // ✅ Clean and send direct image preview if found
      const match = fullResponseText.match(/https:\/\/storage\.googleapis\.com\/chipp-images\/[^\s")\]]+/);
      if (match) {
        const cleanUrl = match[0].replace(/[)\]]+$/, '');
        await sendMessage(senderId, {
          attachment: {
            type: 'image',
            payload: {
              url: cleanUrl,
              is_reusable: true
            }
          }
        }, pageAccessToken);
        return;
      }

      if (!fullResponseText) throw new Error('Empty response from AI.');

      const formatted = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fullResponseText}\n・──── >ᴗ< ────・`;
      for (const chunk of chunkMessage(formatted)) {
        await sendMessage(senderId, { text: chunk }, pageAccessToken);
      }

    } catch (err) {
      console.error('AI Command Error:', err?.response?.data || err.message || err);
      await sendMessage(senderId, { text: '❎ | An error occurred. Please try again later.' }, pageAccessToken);
    }
  },
};