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
  text
    .replace(/^\s*[\*\-•]+\s*\n(?=\s*\*\*)/gm, '') 
    .replace(/(^|\s)\*\*(.+?)\*\*(?=\s|$)/g, (_, s, w) => `${s}\n${[...w].map(c => boldMap[c] || c).join('')}`);

const formatParagraphs = text =>
  text.replace(/([.!?])(\s+)(?=[A-Z])/g, '$1\n\n').replace(/\n{3,}/g, '\n\n').trim();

const getImageUrl = async (e, token) => {
  const mid = e?.message?.reply_to?.mid || e?.message?.mid;
  if (!mid) return null;
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v22.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    return data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
  } catch (err) {
    console.error('Image fetch error:', err?.response?.data || err.message);
    return null;
  }
};

module.exports = {
  name: 'ai',
  description: 'Interact with Google Gemini.',
  usage: 'ai [question]',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage, imageCache) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: 'Ask me something!' }, token);

    let url = await getImageUrl(event, token);
    const cached = imageCache?.get(senderId);
    if (!url && cached && Date.now() - cached.timestamp <= 300000) url = cached.url;

    let imagePart = null;
    if (url) {
      try {
        const { data, headers } = await axios.get(url, { responseType: 'arraybuffer' });
        imagePart = { inline_data: { mimeType: headers['content-type'], data: Buffer.from(data).toString('base64') } };
      } catch {
        return sendMessage(senderId, { text: '❎ | Failed to process the image.' }, token);
      }
    }

    const history = conversations.get(senderId) || [];
    history.push({ role: 'user', parts: imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }] });

    let success = false;
    let reply = null;

    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
      const keyToUse = GEMINI_API_KEYS[(keyIndex + i) % GEMINI_API_KEYS.length];
      try {
        const { data } = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keyToUse}`,
          { contents: history, generationConfig: { responseMimeType: 'text/plain' } },
          { headers: { 'Content-Type': 'application/json' } }
        );

        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (reply) {
          keyIndex = (keyIndex + i) % GEMINI_API_KEYS.length; // update global index
          success = true;
          break;
        }
      } catch (err) {
        console.warn(`API key failed (${keyToUse}):`, err?.response?.data?.error?.message || err.message);
      }
    }

    if (!success || !reply) {
      return sendMessage(senderId, { text: '❎ | All API keys failed. Please try again later.' }, token);
    }

    reply = formatParagraphs(formatBold(reply));
    history.push({ role: 'model', parts: [{ text: reply }] });
    conversations.set(senderId, history.slice(-20));

    const prefix = '💬 | 𝙶𝚘𝚘𝚐𝚕𝚎 𝙶𝚎𝚖𝚒𝚗𝚒\n・───────────・\n';
    const suffix = '\n・──── >ᴗ< ────・';
    const chunks = reply.match(/[\s\S]{1,1900}/g);

    for (let i = 0; i < chunks.length; i++) {
      const part = (i === 0 ? prefix : '') + chunks[i] + (i === chunks.length - 1 ? suffix : '');
      await sendMessage(senderId, { text: part }, token);
      if (i < chunks.length - 1) await sleep(750);
    }
  }
};