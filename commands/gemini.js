const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const GEMINI_API_KEYS = [
  'AIzaSyAowq5pmdXV8GZ4xJrGKSgjsQQ3Ds48Dlg',
  'AIzaSyC5L5DkPyWRDhYfbM5BV1f5zDDYX5_vqfM',
  'AIzaSyDuPD1wDOOPPfEJLo1xp2NGt74JzL7Wz_c',
  'AIzaSyCCBHy1B1-vdGpiNCEYfwxkmVnPUviYd4U'
];
let keyIndex = 0;

const conversations = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const boldMap = Object.fromEntries(
  [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']
    .map(c => [c, String.fromCodePoint(c.charCodeAt(0) + (
      /[a-z]/.test(c) ? 0x1D41A - 97 : /[A-Z]/.test(c) ? 0x1D400 - 65 : 0x1D7CE - 48
    ))])
);

const formatBold = text =>
  text.replace(/(^|\s)\*\*(.+?)\*\*(?=\s|$)/g, (_, s, w) => `${s}\n${[...w].map(c => boldMap[c] || c).join('')}`);

const formatParagraphs = text =>
  text.replace(/([.!?])(\s+)(?=[A-Z])/g, '$1\n\n').replace(/\n{3,}/g, '\n\n').trim();

const getImageUrl = async (e, token) => {
  const mid = e?.message?.reply_to?.mid || e?.message?.mid;
  if (!mid) return null;
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    return data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
  } catch (err) {
    console.error('Image fetch error:', err?.response?.data || err.message);
    return null;
  }
};

const buildImagePart = async (url) => {
  try {
    const { data, headers } = await axios.get(url, { responseType: 'arraybuffer' });
    return {
      inline_data: {
        mimeType: headers['content-type'],
        data: Buffer.from(data).toString('base64')
      }
    };
  } catch {
    return null;
  }
};

const tryAllKeysTwice = async (contents) => {
  const total = GEMINI_API_KEYS.length;

  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < total; i++) {
      const currentKey = GEMINI_API_KEYS[(keyIndex + i) % total];
      try {
        const { data } = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentKey}`,
          { contents, generationConfig: { responseMimeType: 'text/plain' } },
          { headers: { 'Content-Type': 'application/json' } }
        );
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (reply) {
          keyIndex = (keyIndex + i) % total; // Set new working key
          return { success: true, reply };
        }
      } catch (err) {
        console.warn(`❌ Round ${round}, key failed (${currentKey}):`, err?.response?.data?.error?.message || err.message);
      }
    }
  }

  return { success: false };
};

module.exports = {
  name: 'gemini',
  description: 'Interact with Google Gemini.',
  usage: 'gemini [question]',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage, imageCache) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: 'Ask me something!' }, token);

    let imageUrl = await getImageUrl(event, token);
    const cached = imageCache?.get(senderId);
    if (!imageUrl && cached && Date.now() - cached.timestamp <= 300000) imageUrl = cached.url;

    let imagePart = null;
    if (imageUrl) {
      imagePart = await buildImagePart(imageUrl);
      if (!imagePart) return sendMessage(senderId, { text: '❎ | Failed to process the image.' }, token);
    }

    const history = conversations.get(senderId) || [];
    history.push({ role: 'user', parts: imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }] });

    const { reply, success } = await tryAllKeysTwice(history);
    if (!success || !reply) {
      return sendMessage(senderId, { text: '❎ | All API keys failed after two rounds. Please try again later.' }, token);
    }

    const formatted = formatParagraphs(formatBold(reply));
    history.push({ role: 'model', parts: [{ text: formatted }] });
    conversations.set(senderId, history.slice(-20));

    const prefix = '💬 | 𝙶𝚘𝚘𝚐𝚕𝚎 𝙶𝚎𝚖𝚒𝚗𝚒\n・───────────・\n';
    const suffix = '\n・──── >ᴗ< ────・';
    const chunks = formatted.match(/[\s\S]{1,1900}/g);

    for (let i = 0; i < chunks.length; i++) {
      const part = (i === 0 ? prefix : '') + chunks[i] + (i === chunks.length - 1 ? suffix : '');
      await sendMessage(senderId, { text: part }, token);
      if (i < chunks.length - 1) await sleep(750);
    }
  }
};