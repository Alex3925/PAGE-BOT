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
    return data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
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

module.exports = {
  name: 'test',
  description: 'Interact with Mocha AI using text queries and image analysis',
  usage: 'ask a question, or reply to an image with your question.',
  author: 'Coffee',

  async execute(senderId, args, pageAccessToken, event) {
    const prompt = args.join(' ').trim() || 'Hello';
    const chatSessionId = senderId;

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

      let payload;
      if (imageUrl) {
        payload = {
          messages: [{ role: 'user', content: `${prompt}\nImage URL: ${imageUrl}` }],
          chatSessionId,
          toolInvocations: [{
            toolName: 'analyzeImage',
            args: { userQuery: prompt, imageUrls: [imageUrl] }
          }]
        };
      } else {
        payload = {
          messages: [{ role: 'user', content: prompt }],
          chatSessionId
        };
      }

      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", payload, { headers });

      const toolCalls = data?.messages?.[1]?.toolInvocations || [];
      const answerParts = data?.messages?.[1]?.parts?.filter(p => p.type === "text").map(p => p.text).join('') || '';

      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `🖼️ Generated Image:\n${toolCall.result}` }, pageAccessToken);
          return;
        }

        if (toolCall.toolName === 'analyzeImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `Image analysis result: ${toolCall.result}` }, pageAccessToken);
          return;
        }

        if (toolCall.toolName === 'browseWeb' && toolCall.state === 'result' && toolCall.result) {
          const snippets = toolCall.result.organic?.map(r => r.snippet).filter(Boolean).join('\n\n') || '';
          const response = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${answerParts}\n\n🔎 Browse result:\n${snippets}\n・──── >ᴗ< ────・`;
          for (const chunk of chunkMessage(response)) {
            await sendMessage(senderId, { text: chunk }, pageAccessToken);
          }
          return;
        }
      }

      const fallback = answerParts || '❎ | No response received from the assistant.';
      const final = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fallback}\n・──── >ᴗ< ────・`;
      for (const chunk of chunkMessage(final)) {
        await sendMessage(senderId, { text: chunk }, pageAccessToken);
      }

    } catch (err) {
      console.error('AI Command Error:', err?.response?.data || err.message || err);
      await sendMessage(senderId, { text: '❎ | An error occurred. Please try again later.' }, pageAccessToken);
    }
  },
};