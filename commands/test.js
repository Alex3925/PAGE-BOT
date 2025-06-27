const axios = require('axios'), { sendMessage } = require('../handles/sendMessage');

const boldMap = Object.fromEntries([...`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 `].map(c =>
  [c, String.fromCodePoint(c.charCodeAt(0) + (/[\da-z]/.test(c) ? c <= '9' ? 0x1D7CE - 48 : 0x1D41A - 97 : 0x1D400 - 65))])),
  bold = t => t.replace(/\*\*(.+?)\*\*/g, (_, w) => [...w].map(c => boldMap[c] || c).join('')),
  chunk = (t, s = 1900) => t.match(new RegExp(`.{1,${s}}`, 'gs')) || [],
  head = '💬 | 𝙱𝚕𝚊𝚌𝚔𝚋𝚘𝚡 𝙰𝚒\n・────────────・\n', foot = '\n・──── >ᴗ< ─────・',
  history = new Map();

module.exports = {
  name: 'blackbox', description: 'Chat with Blackbox AI',
  usage: 'blackbox [message]', author: 'coffee',

  async execute(id, args, token) {
    const prompt = args.join(' ') || 'Hi';
    const past = history.get(id) || [], messages = [...past, { role: 'user', content: prompt }];
    const payload = {
      messages, id: 'CZ7FOns',
      codeModelMode: true, maxTokens: 1024,
      validated: '00f37b34-a166-4efb-bce5-1312d87f2f94'
    };

    try {
      const res = await axios.post('https://www.blackbox.ai/api/chat', payload, {
        headers: {
          'content-type': 'application/json',
          'origin': 'https://www.blackbox.ai',
          'referer': 'https://www.blackbox.ai/chat/CZ7FOns',
          'cookie': 'sessionId=336f68f2-86a9-4653-a5b5-b26e4c5f04d1'
        }
      });

      let out = (typeof res.data === 'string' ? res.data : '')
        .replace(/\$~~~\$.*?\$~~~\$/gs, '').trim();
      out = bold(out.replace(/^(\w+)\s(?=\1\s)/, ''));
      history.set(id, [...messages, { role: 'assistant', content: out }].slice(-20));

      for (const [i, part] of chunk(out).entries())
        await sendMessage(id, { text: (i ? '' : head) + part + (i === chunk(out).length - 1 ? foot : '') }, token);
    } catch (e) {
      await sendMessage(id, { text: head + '❌ Failed to reach Blackbox.\n' + foot }, token);
    }
  }
};