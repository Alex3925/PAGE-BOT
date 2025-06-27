const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const API_KEY = 'gsk_Hq0by0R8j6vy4xJb3UWDWGd' + 'yb3FYtZIY5xpgchyRJCBUBWWF07DS';
const history = new Map();

module.exports = {
  name: 'groq',
  description: 'Talk to Groq LLaMA 3.3',
  usage: 'groq [message]',
  author: 'coffee',

  async execute(id, args, token, _, send) {
    const q = args.join(' ').trim();
    if (!q) return send(id, { text: '❓ Ask something.' }, token);
    const h = history.get(id) || [];
    h.push({ role: 'user', content: q });

    try {
      const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile', messages: h, temperature: 0.7
      }, { headers: { Authorization: `Bearer ${API_KEY}` } });

      const reply = r.data.choices?.[0]?.message?.content?.trim();
      if (!reply) throw 'Empty';
      h.push({ role: 'assistant', content: reply });
      history.set(id, h.slice(-20));

      const lines = reply.match(/[\s\S]{1,1900}/g);
      for (let i = 0; i < lines.length; i++) {
        await send(id, { text: (i === 0 ? '💬 Groq:\n' : '') + lines[i] }, token);
        if (i + 1 < lines.length) await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      await send(id, { text: '❌ Groq error.' }, token);
    }
  }
};