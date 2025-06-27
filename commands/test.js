const axios = require('axios'), { sendMessage } = require('../handles/sendMessage');

const boldMap = Object.fromEntries([...`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 `].map(c =>
  [c, String.fromCodePoint(c.charCodeAt(0) + (/[\da-z]/.test(c) ? c <= '9' ? 0x1D7CE - 48 : 0x1D41A - 97 : 0x1D400 - 65))]));
const bold = t => t.replace(/\*\*(.+?)\*\*/g, (_, w) => [...w].map(c => boldMap[c] || c).join(''));
const chunk = (t, s = 1900) => t.match(new RegExp(`.{1,${s}}`, 'gs')) || [];
const head = '💬 | 𝙱𝚕𝚊𝚌𝚔𝚋𝚘𝚡 𝙰𝚒\n・────────────・\n', foot = '\n・──── >ᴗ< ─────・';
const history = new Map();

module.exports = {
  name: 'blackbox',
  description: 'Chat with Blackbox AI',
  usage: 'blackbox [message]',
  author: 'coffee',

  async execute(senderId, args, token) {
    const prompt = args.join(' ') || 'Hi';
    const past = history.get(senderId) || [];
    const messages = [...past, { role: 'user', content: prompt }];
    const payload = {
      messages,
      id: senderId, // per-user session
      codeModelMode: true,
      maxTokens: 1024,
      validated: '00f37b34-a166-4efb-bce5-1312d87f2f94'
    };

    try {
      const res = await axios.post('https://www.blackbox.ai/api/chat', payload, {
        headers: {
          'content-type': 'application/json',
          'origin': 'https://www.blackbox.ai',
          'referer': `https://www.blackbox.ai/chat/${senderId}`,
          'cookie': 'sessionId=336f68f2-86a9-4653-a5b5-b26e4c5f04d1'
        }
      });

      let out = typeof res.data === 'string' ? res.data : '';
      out = bold(out.replace(/\$~~~\$.*?\$~~~\$/gs, '').trim().replace(/^(\w+)\s(?=\1\s)/, ''));
      history.set(senderId, [...messages, { role: 'assistant', content: out }].slice(-20));

      for (const [i, part] of chunk(out).entries())
        await sendMessage(senderId, { text: (i ? '' : head) + part + (i === chunk(out).length - 1 ? foot : '') }, token);
    } catch (e) {
      await sendMessage(senderId, { text: head + '❌ Failed to reach Blackbox.\n' + foot }, token);
    }
  }
};