const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const atob = str => Buffer.from(str, 'base64').toString('utf-8');
const GROQ_API_KEY = atob('Z3NrX0hxMGJ5MFI4ajZ2eTR4SmIzVVdEV0dkeWIzRll0WklZNXhwZ2NoeVJKQ0JVQldXRjA3RFM=');

const conversations = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const getImageUrl = async (event, token) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (!mid) return null;
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v23.0/${mid}/attachments`,
      { params: { access_token: token } }
    );
    return data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url;
  } catch (e) {
    console.error('Image fetch error:', e?.response?.data || e.message);
    return null;
  }
};

const buildImageBlock = async (url) => {
  try {
    const { data, headers } = await axios.get(url, { responseType: 'arraybuffer' });
    const mime = headers['content-type'];
    const base64 = Buffer.from(data).toString('base64');
    return {
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${base64}` }
    };
  } catch (e) {
    console.error('Image conversion error:', e.message);
    return null;
  }
};

const sendToGroq = async (messages) => {
  try {
    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply ? { success: true, reply } : { success: false };
  } catch (e) {
    console.warn('Groq API error:', e?.response?.data || e.message);
    return { success: false };
  }
};

module.exports = {
  name: 'groq',
  description: 'Chat with Groq using llama‑3.3‑70b‑versatile (June 2025)',
  usage: 'groq [prompt]',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage, imageCache) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: '❓ Please enter your question.' }, token);

    let imageUrl = await getImageUrl(event, token);
    const cached = imageCache?.get(senderId);
    if (!imageUrl && cached && Date.now() - cached.timestamp < 300000) {
      imageUrl = cached.url;
    }
    if (imageUrl) {
      imageCache?.set(senderId, { url: imageUrl, timestamp: Date.now() });
    }

    const userMessage = { role: 'user', content: [] };
    userMessage.content.push({ type: 'text', text: prompt });

    if (imageUrl) {
      const imagePart = await buildImageBlock(imageUrl);
      if (!imagePart) {
        return sendMessage(senderId, { text: '❎ Failed to process the image.' }, token);
      }
      userMessage.content.push(imagePart);
    }

    const history = conversations.get(senderId) || [];
    history.push(userMessage);

    const { success, reply } = await sendToGroq(history);
    if (!success) {
      return sendMessage(senderId, { text: '❌ Groq API failed. Please try again later.' }, token);
    }

    history.push({ role: 'assistant', content: reply });
    conversations.set(senderId, history.slice(-20));

    const chunks = reply.match(/[\s\S]{1,1900}/g);
    const prefix = '💬 | 𝙶𝚛𝚘𝚚 𝙻𝙻𝙼 (𝐋𝐋𝐀𝐌𝐀 𝟑.𝟑)\n・───────────・\n';
    const suffix = '\n・──── >ᴗ< ────・';

    for (let i = 0; i < chunks.length; i++) {
      const text = (i === 0 ? prefix : '') + chunks[i] + (i === chunks.length - 1 ? suffix : '');
      await sendMessage(senderId, { text }, token);
      if (i < chunks.length - 1) await sleep(750);
    }
  }
};