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

module.exports = {
  name: 'test',
  description: 'Interact with Mocha AI using text queries and image analysis',
  usage: 'ask a question, or reply to an image with your question.',
  author: 'Coffee',

  async execute(senderId, args, pageAccessToken, event) {
    const prompt = args.join(' ').trim() || 'Hello';
    const chatSessionId = "fc053908-a0f3-4a9c-ad4a-008105dcc360";

    const headers = {
      "content-type": "application/json",
      "sec-ch-ua-platform": "\"Android\"",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua": "\"Chromium\";v=\"136\", \"Brave\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?1",
      "accept": "*/*",
      "sec-gpc": "1",
      "accept-language": "en-US,en;q=0.9",
      "origin": "https://digitalprotg-32922.chipp.ai",
      "referer": "https://digitalprotg-32922.chipp.ai/w/chat/",
      "cookie": "__Host-next-auth.csrf-token=4723c7d0081a66dd0b572f5e85f5b40c2543881365782b6dcca3ef7eabdc33d6%7C06adf96c05173095abb983f9138b5e7ee281721e3935222c8b369c71c8e6536b; __Secure-next-auth.callback-url=https%3A%2F%2Fapp.chipp.ai; userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5; correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8",
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

      const raw = typeof data === 'string' ? data : JSON.stringify(data);
      const responseTextChunks = raw.match(/0:"(.*?)"/g)?.map(x => x.slice(3, -1).replace(/\\n/g, '\n')) || [];
      const fullResponseText = responseTextChunks.join('');

      const toolCalls = data?.choices?.[0]?.message?.toolInvocations || [];

      // store real assistant response in history
      if (fullResponseText) {
        conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });
      }

      // process tool result
      for (const toolCall of toolCalls) {
        const { toolName, result, state } = toolCall;
        if (state !== 'result') continue;

        if (toolName === 'generateImage' && result) {
          await sendMessage(senderId, { text: `🖼️ Generated Image:\n${result}` }, pageAccessToken);
          return;
        }

        if (toolName === 'analyzeImage' && result) {
          await sendMessage(senderId, { text: `Image analysis result: ${result}` }, pageAccessToken);
          return;
        }

        if (toolName === 'browseWeb') {
          // Only send the assistant reply — ignore snippets/links
          const formatted = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fullResponseText}\n・──── >ᴗ< ────・`;
          for (const chunk of chunkMessage(formatted)) {
            await sendMessage(senderId, { text: chunk }, pageAccessToken);
          }
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