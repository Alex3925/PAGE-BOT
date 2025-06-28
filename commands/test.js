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

const split = (text, n = 1900) => text.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

module.exports = {
  name: 'ai',
  description: 'Interact with ChatGPT',
  usage: 'ai <prompt>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const prompt = args.join(' ') || 'hello';
    const url = `https://kaiz-apis.gleeze.com/api/gpt-4o?ask=${encodeURIComponent(prompt)}&uid=${senderId}&webSearch=off&apikey=0bc1e20e-ec47-4c92-a61f-1c626e7edab7`;

    try {
      const { data } = await axios.get(url);
      const response = bold(data?.response ?? '✅ No response.');
      for (const chunk of split(response)) await sendMessage(senderId, chunk);
    } catch (err) {
      console.error('❌ AI error:', err?.response?.data || err.message);
      await sendMessage(senderId, '❌ Failed to reach ChatGPT.');
    }
  }
};