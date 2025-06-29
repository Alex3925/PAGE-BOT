const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

const conversationHistory = {};
const lastImagePerSender = {};

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

const uploadImageToFacebook = async (imageUrl, token) => {
  const tmpFilePath = path.join(__dirname, `tmp_${Date.now()}.jpg`);
  const response = await axios.get(imageUrl, { responseType: 'stream' });
  const writer = fs.createWriteStream(tmpFilePath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  const form = new FormData();
  form.append('message', JSON.stringify({
    attachment: {
      type: 'image',
      payload: { is_reusable: true },
    },
  }));
  form.append('filedata', fs.createReadStream(tmpFilePath));

  const uploadRes = await axios.post(
    `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${token}`,
    form,
    { headers: form.getHeaders() }
  );

  fs.unlinkSync(tmpFilePath);
  return uploadRes.data.attachment_id;
};

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
      if (!conversationHistory[senderId]) conversationHistory[senderId] = [];

      const imageUrl = await getImageUrl(event, pageAccessToken) || lastImagePerSender[senderId] || null;
      if (imageUrl) lastImagePerSender[senderId] = imageUrl;

      let payload;
      if (imageUrl) {
        payload = {
          messages: [...conversationHistory[senderId], { role: 'user', content: `${prompt}\nImage URL: ${imageUrl}` }],
          chatSessionId,
          toolInvocations: [{
            toolName: 'analyzeImage',
            args: { userQuery: prompt, imageUrls: [imageUrl] }
          }]
        };
      } else {
        payload = {
          messages: [...conversationHistory[senderId], { role: 'user', content: prompt }],
          chatSessionId
        };
      }

      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", payload, { headers });

      const textData = typeof data === 'string' ? data : JSON.stringify(data);
      const responseTextChunks = textData.match(/"result":"(.*?)"/g)?.map(c => c.slice(10, -1).replace(/\\n/g, '\n')) ||
                                 textData.match(/0:"(.*?)"/g)?.map(c => c.slice(3, -1).replace(/\\n/g, '\n')) || [];

      const fullResponseText = responseTextChunks.join('');
      const toolCalls = data.choices?.[0]?.message?.toolInvocations || [];

      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {
          const match = toolCall.result.match(/!Generated Image:\s*(.*?)(https?:\/\/[^\s)]+)/i);
          if (!match) throw new Error('Invalid image format in result.');

          const imageUrl = match[2];
          const attachmentId = await uploadImageToFacebook(imageUrl, pageAccessToken);
          await axios.post(`https://graph.facebook.com/v22.0/me/messages?access_token=${pageAccessToken}`, {
            recipient: { id: senderId },
            message: {
              attachment: {
                type: 'image',
                payload: { attachment_id: attachmentId }
              }
            }
          });
          return;
        }

        if (toolCall.toolName === 'analyzeImage' && toolCall.state === 'result' && toolCall.result) {
          await sendMessage(senderId, { text: `Image analysis result: ${toolCall.result}` }, pageAccessToken);
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

      if (!fullResponseText) throw new Error('Empty response from AI.');

      conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });
      if (conversationHistory[senderId].length > 20) {
        conversationHistory[senderId] = conversationHistory[senderId].slice(-20);
      }

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