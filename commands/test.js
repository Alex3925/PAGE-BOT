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

module.exports = {
  name: 'test',
  description: 'Free GPT (no key needed)',
  usage: 'ai <question>',
  author: 'coffee',

  async execute(senderId, args, token) {
    const q = encodeURIComponent(args.join(' ') || 'hello');
    const url = `https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/chat/?query=${q}`;

    try {
      const { data } = await axios.get(url);
      const resp = bold(data?.response ?? '✅ No response.');
      for (const chunk of split(resp)) {
        await sendMessage(senderId, { text: chunk }, token);
      }
    } catch (err) {
      console.error('❌ Free GPT error:', err?.message);
      await sendMessage(senderId, { text: '❌ Failed to reach free GPT API.' }, token);
    }
  }
};