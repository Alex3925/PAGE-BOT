const axios = require('axios'), { sendMessage } = require('../handles/sendMessage'), key = 'gsk_Hq0by0R8j6vy4xJb3UWDWGd' + 'yb3FYtZIY5xpgchyRJCBUBWWF07DS', history = new Map(), sleep = ms => new Promise(r => setTimeout(r, ms)), bold = Object.fromEntries([...`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`].map(c => [c, String.fromCodePoint(c.charCodeAt(0) + (/[\da-z]/.test(c) ? c <= '9' ? 0x1D7CE - 48 : 0x1D41A - 97 : 0x1D400 - 65))])), fmt = t => t.replace(/(^|\s)\*\*(.+?)\*\*(?=\s|$)/g, (_, s, w) => `${s}${[...w].map(c => bold[c] || c).join('')}`);

module.exports = {
  name: 'groq',
  description: 'Talk to Groq AI',
  usage: 'groq [prompt]',
  author: 'coffee',
  async execute(id, args, token, _, send) {
    const q = args.join(' ').trim(); if (!q) return send(id, { text: '❓ Ask something.' }, token);
    const h = history.get(id) || []; h.push({ role: 'user', content: q });
    try {
      const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile', messages: h, temperature: 0.7
      }, { headers: { Authorization: `Bearer ${key}` } });
      const raw = r.data.choices?.[0]?.message?.content?.trim() || '', reply = fmt(raw);
      h.push({ role: 'assistant', content: reply }); history.set(id, h.slice(-20));
      const prefix = '💬 | 𝙶𝚛𝚘𝚚 𝙰𝙸\n・───────────・\n', suffix = '\n・──── >ᴗ< ────・', parts = reply.match(/[\s\S]{1,1900}/g);
      for (let i = 0; i < parts.length; i++) {
        await send(id, { text: (i === 0 ? prefix : '') + parts[i] + (i === parts.length - 1 ? suffix : '') }, token);
        if (i + 1 < parts.length) await sleep(500);
      }
    } catch (e) {
      console.error('Groq fail:', e?.response?.data || e.message);
      send(id, { text: '❌ Groq error. Try again later.' }, token);
    }
  }
};