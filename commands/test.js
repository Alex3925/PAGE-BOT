const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const API_KEY = '0bc1e20e-ec47-4c92-a61f-1c626e7edab7';

const getImageUrl = async (event, token) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (!mid) return '';
  try {
    const res = await axios.get(`https://graph.facebook.com/v18.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    return res.data?.data?.[0]?.image_data?.url || res.data?.data?.[0]?.file_url || '';
  } catch {
    return '';
  }
};

module.exports = {
  name: 'gpt',
  description: 'Chat with GPT-4o via Kaiz API',
  usage: 'gpt [your message]',
  author: 'Kaizenji',

  async execute(senderId, args, token, event, sendMessage, imageCache) {
    const ask = args.join(' ').trim();
    if (!ask) return sendMessage(senderId, { text: '❎ | Please enter a message.' }, token);

    const cached = imageCache?.get(senderId);
    const url = await getImageUrl(event, token) || (Date.now() - (cached?.timestamp || 0) < 300000 && cached.url) || '';

    try {
      const res = await axios.get('https://kaiz-apis.gleeze.com/api/gpt4o-latest', {
        params: { ask, uid: senderId, imageUrl: url, apikey: API_KEY }
      });

      const reply = res.data?.response;
      if (!reply) return sendMessage(senderId, { text: '❎ | No response from GPT.' }, token);

      const prefix = '💬 | GPT-4o (Kaiz)\n・───────────・\n';
      const suffix = '\n・──── >ᴗ< ────・';
      const chunks = reply.match(/[\s\S]{1,1900}/g);

      for (let i = 0; i < chunks.length; i++) {
        await sendMessage(senderId, {
          text: (i === 0 ? prefix : '') + chunks[i] + (i === chunks.length - 1 ? suffix : '')
        }, token);
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error('GPT error:', err?.response?.data || err.message);
      sendMessage(senderId, { text: '❎ | Failed to connect to GPT service.' }, token);
    }
  }
};