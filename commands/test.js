const axios = require('axios'), { sendMessage } = require('../handles/sendMessage');
const API_KEY = 'gsk_Hq0by0R8j6vy4xJb3UWDWGd' + 'yb3FYtZIY5xpgchyRJCBUBWWF07DS';
const history = new Map(), sleep = ms => new Promise(r => setTimeout(r, ms));

const boldMap = Object.fromEntries(
  [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']
    .map(c => [c, String.fromCodePoint(c.charCodeAt(0) + (
      /[a-z]/.test(c) ? 0x1D41A - 97 : /[A-Z]/.test(c) ? 0x1D400 - 65 : 0x1D7CE - 48
    ))])
);
const formatBold = t =>
  t.replace(/\*\*(.+?)\*\*/g, (_, w) => [...w].map(c => boldMap[c] || c).join(''));

module.exports = {
  name: 'groq',
  description: 'Talk to Groq AI (LLaMA 3.3)',
  usage: 'groq [your message]',
  author: 'coffee',

  async execute(id, args, token, _, send) {
    const q = args.join(' ').trim();
    if (!q) return send(id, { text: '❓ Ask me something.' }, token);

    const h = history.get(id) || [];
    h.push({ role: 'user', content: q });

    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: h,
        temperature: 0.7
      }, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });

      const raw = res.data.choices?.[0]?.message?.content?.trim() || '';
      const reply = formatBold(raw);
      h.push({ role: 'assistant', content: reply });
      history.set(id, h.slice(-20));

      const parts = reply.match(/[\s\S]{1,1900}/g);
      const prefix = '💬 | 𝙶𝚛𝚘𝚚 𝙰𝙸\n・───────────・\n';
      const suffix = '\n・──── >ᴗ< ────・';

      for (let i = 0; i < parts.length; i++) {
        const msg = (i === 0 ? prefix : '') + parts[i] + (i === parts.length - 1 ? suffix : '');
        await send(id, { text: msg }, token);
        if (i < parts.length - 1) await sleep(500);
      }
    } catch (e) {
      console.error('Groq error:', e?.response?.data || e.message);
      send(id, { text: '❌ Groq error. Try again later.' }, token);
    }
  }
};