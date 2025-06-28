const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const bold = t => t.replace(/\*\*(.+?)\*\*/g, (_, w) =>
  [...w].map(c => {
    const code = c.codePointAt(0);
    return /[A-Z]/.test(c) ? String.fromCodePoint(code + 0x1D400 - 65)
         : /[a-z]/.test(c) ? String.fromCodePoint(code + 0x1D41A - 97)
         : /\d/.test(c)     ? String.fromCodePoint(code + 0x1D7CE - 48)
         : c;
  }).join('')
);

const split = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

const getImageUrl = async (e, token) => {
  const mid = e?.message?.reply_to?.mid || e?.message?.mid;
  if (!mid) return null;
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    const a = data?.data?.[0];
    return a?.image_data?.url ?? a?.file_url ?? null;
  } catch (err) {
    console.error('🖼️ Image error:', err?.response?.data || err.message);
    return null;
  }
};

module.exports = {
  name: 'test',
  description: 'Interact with ChatGPT',
  usage: 'ai <prompt>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage, imageCache) {
    const q = args.join(' ') || 'hello';
    let image = await getImageUrl(event, token);
    if (!image && imageCache?.has(senderId)) {
      const cached = imageCache.get(senderId);
      if (Date.now() - cached.timestamp < 300_000) image = cached.url;
    }

    const prompt = image ? `${q}\n[Image: ${image}]` : q;
    const url = `https://kaiz-apis.gleeze.com/api/gpt-4o?ask=${encodeURIComponent(prompt)}&uid=${senderId}&webSearch=off&apikey=0bc1e20e-ec47-4c92-a61f-1c626e7edab7`;

    try {
      const { data } = await axios.get(url);
      const response = bold(data?.response ?? '✅ No reply.');
      for (const chunk of split(response)) await sendMessage(senderId, chunk);
    } catch (err) {
      console.error('❌ AI error:', err?.response?.data || err.message);
      await sendMessage(senderId, '❌ ChatGPT API failed.');
    }
  }
};