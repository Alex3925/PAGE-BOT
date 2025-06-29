const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

const imageCache = new Map();

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

const downloadAndSendImage = async (imageUrl, senderId, token) => {
  const filePath = path.join(__dirname, 'tmp_image.jpg');
  try {
    const img = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, Buffer.from(img.data));

    const form = new FormData();
    form.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
    form.append('filedata', fs.createReadStream(filePath));

    const upload = await axios.post(
      `https://graph.facebook.com/v17.0/me/message_attachments?access_token=${token}`,
      form, { headers: form.getHeaders() }
    );

    const attachmentId = upload.data.attachment_id;
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${token}`,
      {
        recipient: { id: senderId },
        message: { attachment: { type: 'image', payload: { attachment_id: attachmentId } } }
      }
    );
  } catch (err) {
    console.error('Image upload error:', err.message);
    await sendMessage(senderId, { text: '❎ Failed to send generated image.' }, token);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

module.exports = {
  name: 'test',
  description: 'Mocha AI chat via Chipp, each user has own conversation',
  usage: 'Send message, reply to image, or say "generate ..."',
  author: 'Coffee',

  async execute(senderId, args, token, event) {
    const prompt = args.join(' ').trim() || 'Hello';
    const appNameId = 'DigitalProtg-32922';
    const chatSessionId = senderId;

    const imageUrl = await getImageUrl(event, token, senderId)
      || (imageCache.get(senderId)?.timestamp > Date.now() - 300000 ? imageCache.get(senderId).url : null);

    const userMessage = imageUrl ? `${prompt}\nImage URL: ${imageUrl}` : prompt;
    const isGenerate = /^generate\b/i.test(prompt);

    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "Referer": "https://digitalprotg-32922.chipp.ai/w/chat/",
      "Origin": "https://digitalprotg-32922.chipp.ai",
      "x-where-the-chat-is-being-viewed": "CONSUMER_VIEW",
      "Accept": "application/json, text/plain, */*",
      "Cookie": [
        "__Host-authjs.csrf-token=582e72dfce35596f5f80d697e4399711c206c6acaa1c34209360529e53932270%7Ccaeaa4d1798ea17ff6c25c93b0357a63f49846a280cb80c3a541ef523e2cdd16",
        "__Secure-authjs.callback-url=https%3A%2F%2Fapp.chipp.ai",
        `userId_32922=${senderId}`,
        `chatSessionId_32922=${senderId}`,
        "correlationId=48394f13-eb27-4f86-8d77-e467c6aa1789"
      ].join('; ')
    };

    try {
      const chatHistoryRes = await axios.get(
        `https://digitalprotg-32922.chipp.ai/w/chat/api/chat-history/chat-sessions-for-user`,
        {
          params: { id: chatSessionId, appNameId },
          headers
        }
      );

      const history = (chatHistoryRes.data?.messages || []).map(m => ({
        role: m.senderType === 'USER' ? 'user' : 'assistant',
        content: m.content
      }));

      history.push({ role: 'user', content: userMessage });

      const payload = {
        chatSessionId,
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

      const { data } = await axios.post("https://app.chipp.ai/api/chat", payload, { headers });

      const tools = data?.choices?.[0]?.message?.toolInvocations || [];
      for (const t of tools) {
        if (t.state === 'result') {
          if (t.toolName === 'generateImage') {
            const urls = t?.result?.images || [];
            for (const url of urls) await downloadAndSendImage(url, senderId, token);
            return;
          }
          const msg = t?.result?.answerBox?.answer || t?.result;
          if (msg) {
            return sendMessage(senderId, {
              text: `${t.toolName === 'browseWeb' ? 'Search result' : t.toolName === 'analyzeImage' ? 'Image analysis' : 'Tool result'}: ${msg}`
            }, token);
          }
        }
      }

      const fallback = data?.choices?.[0]?.message?.content
        || (data.match?.(/"result":"(.*?)"/g) || []).map(r => r.slice(10, -1).replace(/\\n/g, '\n')).join('').trim();

      if (!fallback) throw new Error('No response returned.');

      const reply = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fallback}\n・──── >ᴗ< ────・`;
      for (let i = 0; i < reply.length; i += 1900)
        await sendMessage(senderId, { text: reply.slice(i, i + 1900) }, token);

    } catch (e) {
      console.error('AI error:', e?.response?.data || e.message);
      await sendMessage(senderId, { text: '❌ Error: Failed to get AI response.' }, token);
    }
  }
};