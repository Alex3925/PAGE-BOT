const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const splitText = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

async function getSessionToken() {
  const res = await axios.get('https://duckduckgo.com/duckchat/v1/status', {
    headers: { 'x-vqd-accept': '1' }
  });
  return res.headers['x-vqd-4'];
}

async function streamReply(prompt, vqd) {
  const res = await axios.post(
    'https://duckduckgo.com/duckchat/v1/chat',
    {
      model: 'gpt-4o-mini', // explicitly request GPT-4o-mini
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-vqd-4': vqd,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      responseType: 'stream'
    }
  );

  return new Promise((resolve, reject) => {
    let result = '';
    res.data.on('data', chunk => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = JSON.parse(line.slice(6));
          if (payload.message) result += payload.message;
          if (payload.action === 'success') {
            res.data.destroy();
            resolve(result);
          }
        }
      }
    });
    res.data.on('error', reject);
  });
}

module.exports = {
  name: 'test',
  description: 'Talk to GPT-4o Mini via DuckDuckGo',
  usage: 'duckchat <your message>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: '❓ Please provide a message.' }, token);

    try {
      const vqd = await getSessionToken();
      const reply = await streamReply(prompt, vqd);

      for (const part of splitText(reply)) {
        await sendMessage(senderId, { text: part }, token);
      }
    } catch (err) {
      console.error('❌ DuckChat error:', err?.response?.data || err.message);
      await sendMessage(senderId, { text: '❌ Failed to reach GPT-4o Mini via DuckChat.' }, token);
    }
  }
};