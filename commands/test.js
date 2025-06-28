const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const conversations = new Map();

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
  name: 'perplexity',
  description: 'Ask anything via Perplexity AI',
  usage: 'perplexity <your question>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const query = args.join(' ').trim();
    if (!query) return sendMessage(senderId, '❓ | Please provide a question.');

    const history = conversations.get(senderId) || [];
    history.push({ role: 'user', content: query });

    try {
      const { data } = await axios.post('https://api.perplexity.dev/chat', {
        model: 'llama-3-sonar-large-32k-online',
        messages: history
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const reply = data?.choices?.[0]?.message?.content ?? '✅ No response.';
      history.push({ role: 'assistant', content: reply });
      conversations.set(senderId, history.slice(-20)); // keep last 20 exchanges

      for (const chunk of split(bold(reply)))
        await sendMessage(senderId, chunk);

    } catch (err) {
      console.error('❌ Perplexity API Error:', err?.response?.data || err.message);
      await sendMessage(senderId, '❌ Failed to reach Perplexity API.');
    }
  }
};