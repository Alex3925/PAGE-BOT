const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendMessage } = require('../handles/sendMessage');

// Image cache: stores last image URL per sender
const imageCache = new Map();
const IMAGE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const getImageUrl = async (event, token, senderId) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;

  // Fallback to cache if not replying
  if (!mid) {
    const cached = imageCache.get(senderId);
    if (cached && Date.now() - cached.timestamp < IMAGE_EXPIRY) {
      console.log(`Using cached image for sender ${senderId}`);
      return cached.url;
    } else {
      imageCache.delete(senderId);
      return null;
    }
  }

  try {
    const { data } = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token },
    });
    const imageUrl = data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
    if (imageUrl) {
      imageCache.set(senderId, { url: imageUrl, timestamp: Date.now() });
    }
    return imageUrl;
  } catch (err) {
    console.error("Image URL fetch error:", err?.response?.data || err.message);
    return null;
  }
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

module.exports = {
  name: 'test',
  description: 'Interact with Mocha AI using text queries and image analysis',
  usage: 'ask a question, or reply to an image with your question.',
  author: 'Coffee',

  async execute(senderId, args, pageAccessToken, event) {
    const prompt = args.join(' ').trim() || 'Hello';
    const chatSessionId = sessionIds[sessionIndex++ % sessionIds.length];

    // Cache any image in attachments
    const attachments = event?.message?.attachments || [];
    for (const attachment of attachments) {
      if (attachment.type === 'image' && attachment.payload?.url) {
        console.log(`Caching image for sender ${senderId}: ${attachment.payload.url}`);
        imageCache.set(senderId, {
          url: attachment.payload.url,
          timestamp: Date.now()
        });
      }
    }

    const headers = {
      "content-type": "application/json",
      "origin": "https://digitalprotg-32922.chipp.ai",
      "referer": "https://digitalprotg-32922.chipp.ai/w/chat/"
    };

    try {
      const imageUrl = await getImageUrl(event, pageAccessToken, senderId);
      if (!conversationHistory[senderId]) conversationHistory[senderId] = [];

      if (conversationHistory[senderId].length > MAX_HISTORY) {
        conversationHistory[senderId] = conversationHistory[senderId].slice(-KEEP_RECENT);
      }

      conversationHistory[senderId].push({ role: 'user', content: prompt });

      const payload = {
        chatSessionId,
        messages: conversationHistory[senderId],
      };

      if (imageUrl) {
        payload.toolInvocations = [{
          toolName: 'analyzeImage',
          args: { userQuery: prompt, imageUrls: [imageUrl] }
        }];
      }

      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", payload, { headers });
      const textData = typeof data === 'string' ? data : JSON.stringify(data);

      const streamed = textData.match(/0:\"(.*?)\"/g);
      const fullResponseText = streamed?.map(t => t.slice(3, -1).replace(/\\n/g, '\n')).join('') || '';

      const toolCalls = data?.choices?.[0]?.message?.toolInvocations || [];

      if (fullResponseText) {
        conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });
      }

      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `🖼️ Generated Image:\n${toolCall.result}` }, pageAccessToken);
          return;
        }

        if (toolCall.toolName === 'analyzeImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `📷 Image analysis result:\n${toolCall.result}` }, pageAccessToken);
          return;
        }
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