const axios = require('axios');
const cheerio = require('cheerio');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Chat with DuckDuckGo GPT-4o Mini',
  usage: 'duckchat [message]',
  author: 'Mark Sombra',

  async execute(senderId, args, token, event, sendMessage) {
    const input = args.join(' ').trim();
    if (!input) return sendMessage(senderId, { text: '❎ | Please enter a message.' }, token);

    try {
      const res = await axios.post(
        'https://duckduckgo.com/duckchat/v1/chat',
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: input }] },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://duckduckgo.com',
            'Referer': 'https://duckduckgo.com/chat',
          }
        }
      );

      const html = res.data?.output?.content;
      if (!html) return sendMessage(senderId, { text: '❎ | No response from DuckDuckGo.' }, token);

      const $ = cheerio.load(html);
      const clean = $('body').text().trim() || $.text().trim();
      const chunks = clean.match(/[\s\S]{1,1900}/g) || [clean];

      const prefix = '💬 | 𝙳𝚞𝚌𝚔𝙲𝚑𝚊𝚝 GPT-4o Mini\n・───────────・\n';
      const suffix = '\n・──── >ᴗ< ────・';

      for (let i = 0; i < chunks.length; i++) {
        await sendMessage(senderId, {
          text: (i === 0 ? prefix : '') + chunks[i] + (i === chunks.length - 1 ? suffix : '')
        }, token);
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
      }

    } catch (err) {
      console.error('DuckChat error:', err?.response?.data || err.message);
      sendMessage(senderId, { text: '❎ | Failed to reach DuckDuckGo Chat.' }, token);
    }
  }
};