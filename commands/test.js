const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// ⏳ In-memory image cache
const imageCache = new Map();

// 📥 Get image from reply or current message
const getImageUrl = async (event, token, senderId) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (!mid) return null;

  try {
    const { data } = await axios.get(`https://graph.facebook.com/v22.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    const file = data?.data?.[0];
    const url = file?.image_data?.url || file?.file_url || null;

    if (url) imageCache.set(senderId, { url, timestamp: Date.now() });
    return url;
  } catch (e) {
    console.error("Image fetch error:", e?.response?.data || e.message);
    return null;
  }
};

// 📤 Download and send image via attachment_id
const downloadAndSendImage = async (imageUrl, senderId, pageAccessToken) => {
  try {
    const img = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const filePath = path.join(__dirname, 'tmp_image.jpg');
    fs.writeFileSync(filePath, Buffer.from(img.data));

    const form = new FormData();
    form.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
    form.append('filedata', fs.createReadStream(filePath));

    const uploadRes = await axios.post(
      `https://graph.facebook.com/v17.0/me/message_attachments?access_token=${pageAccessToken}`,
      form, { headers: form.getHeaders() }
    );

    const attachmentId = uploadRes.data.attachment_id;
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`,
      {
        recipient: { id: senderId },
        message: { attachment: { type: 'image', payload: { attachment_id: attachmentId } } }
      }
    );

    fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Image upload error:', err.message);
    await sendMessage(senderId, { text: '❎ Failed to send generated image.' }, pageAccessToken);
  }
};

const conversation = {};

module.exports = {
  name: 'test',
  description: 'Mocha AI chat, image analysis, and image generation',
  usage: 'Send a question, reply to an image, or say "generate ..."',
  author: 'Coffee',

  async execute(senderId, args, token, event) {
    const prompt = args.join(' ').trim() || 'Hello';
    const session = "1ad0e936-7840-4a44-812c-2718277b33a5"; // updated from your cookies
    const history = conversation[senderId] ||= [];

    let imageUrl = await getImageUrl(event, token, senderId);

    const cached = imageCache.get(senderId);
    if (!imageUrl && cached && Date.now() - cached.timestamp <= 300000)
      imageUrl = cached.url;

    const userMsg = imageUrl ? `${prompt}\nImage URL: ${imageUrl}` : prompt;
    history.push({ role: 'user', content: userMsg });

    const isGenerate = /^generate\b/i.test(prompt);

    const payload = {
      chatSessionId: session,
      messages: [...history],
      ...(imageUrl && {
        toolInvocations: [{
          toolName: 'analyzeImage',
          args: { userQuery: prompt, imageUrls: [imageUrl] }
        }]
      }),
      ...(isGenerate && {
        toolInvocations: [{
          toolName: 'generateImage',
          args: { prompt, n: 1 }
        }]
      })
    };

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "Referer": "https://digitalprotg-32922.chipp.ai/w/chat/",
      "Cookie": [
        "__Host-authjs.csrf-token=2575d281272005994d15398a25956c538b652319e2333c33f28e658b5cab2a7b%7C07dc408ae65195b30be39e8705510b7e6335114a3722e29cc2dd6ad1d88929cf",
        "__Secure-authjs.callback-url=https%3A%2F%2Fapp.chipp.ai",
        "userId_32922=a5333726-38d4-4624-94c2-faafb3feac0f",
        "chatSessionId_32922=1ad0e936-7840-4a44-812c-2718277b33a5",
        "correlationId=bbb88745-0a7f-4004-8489-7db69bba30f2"
      ].join("; ")
    };

    try {
      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", payload, { headers });

      const tools = data?.choices?.[0]?.message?.toolInvocations || [];
      for (const t of tools) {
        if (t.state === 'result') {
          if (t.toolName === 'generateImage') {
            const urls = t?.result?.images || [];
            if (urls.length) {
              for (const url of urls) {
                await downloadAndSendImage(url, senderId, token);
              }
              return;
            }
          }

          const msg = t?.result?.answerBox?.answer || t?.result;
          if (msg) {
            return sendMessage(senderId, {
              text: `${t.toolName === 'browseWeb' ? 'Search result' : t.toolName === 'analyzeImage' ? 'Image analysis' : 'Tool result'}: ${msg}`
            }, token);
          }
        }
      }

      const matchResult = (data.match(/"result":"(.*?)"/g) || [])
        .map(r => r.slice(10, -1).replace(/\\n/g, '\n')).join('').trim();

      const fallbackText = data?.choices?.[0]?.message?.content || matchResult;
      if (!fallbackText) throw new Error('No response text available.');

      history.push({ role: 'assistant', content: fallbackText });

      const reply = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fallbackText}\n・──── >ᴗ< ────・`;
      for (let i = 0; i < reply.length; i += 1900)
        await sendMessage(senderId, { text: reply.slice(i, i + 1900) }, token);

    } catch (e) {
      console.error('AI error:', e?.response?.data || e.message);
      await sendMessage(senderId, { text: '❌ Error: Failed to get AI response.' }, token);
    }
  }
};