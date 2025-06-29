const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendMessage } = require('../handles/sendMessage');

const getImageUrl = async (event, token) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (!mid) return null;

  try {
    const { data } = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token },
    });
    const imageUrl = data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
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

    const headers = {
      "content-type": "application/json",
      "referer": "https://digitalprotg-32922.chipp.ai/w/chat/",
      "origin": "https://digitalprotg-32922.chipp.ai",
      "cookie": "__Host-next-auth.csrf-token=4723c7d0081a66dd0b572f5e85f5b40c2543881365782b6dcca3ef7eabdc33d6%7C06adf96c05173095abb983f9138b5e7ee281721e3935222c8b369c71c8e6536b; __Secure-next-auth.callback-url=https%3A%2F%2Fapp.chipp.ai; userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5; correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8"
    };

    try {
      const imageUrl = await getImageUrl(event, pageAccessToken);
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
      const streamed = textData.match(/0:"(.*?)"/g);
      const fullResponseText = streamed?.map(t => t.slice(3, -1).replace(/\\n/g, '\n')).join('') || '';

      if (fullResponseText) {
        conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });
      }

      const toolCalls = data?.choices?.[0]?.message?.toolInvocations || [];

      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `🖼️ Generated Image:\n${toolCall.result}` }, pageAccessToken);
          return;
        }

        if (toolCall.toolName === 'analyzeImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `Image analysis result: ${toolCall.result}` }, pageAccessToken);
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