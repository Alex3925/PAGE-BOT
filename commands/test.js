const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MODELS = [
  { id: 'gpt-4o-mini', label: '🤖 GPT-4o Mini' },
  { id: 'claude-3-haiku-20240307', label: '🧠 Claude 3 Haiku' },
  { id: 'meta-llama/llama-3.3-70b-instruct-turbo', label: '🦙 LLaMA 3.3 70B' },
  { id: 'mistral-small-3', label: '🌪️ Mistral Small 3' }
];

const splitText = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

async function getSessionToken() {
  const res = await axios.get('https://duckduckgo.com/duckchat/v1/status', {
    headers: { 'x-vqd-accept': '1' }
  });
  return res.headers['x-vqd-4'];
}

async function tryModel(prompt, modelId, vqd) {
  try {
    const res = await axios.post(
      'https://duckduckgo.com/duckchat/v1/chat',
      { model: modelId, messages: [{ role: 'user', content: prompt }] },
      {
        headers: {
          'x-vqd-4': vqd,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        responseType: 'stream'
      }
    );

    return await new Promise((resolve, reject) => {
      let reply = '';
      res.data.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = JSON.parse(line.slice(6));
            if (json.message) reply += json.message;
            if (json.action === 'success') {
              res.data.destroy();
              return resolve(reply);
            }
          }
        }
      });
      res.data.on('error', reject);
    });
  } catch (err) {
    console.warn(`❌ ${modelId} failed:`, err.message || err);
    return null;
  }
}

module.exports = {
  name: 'test',
  description: 'Talk to any available model via DuckDuckGo AI',
  usage: 'duckchat <your message>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: '❓ Please provide a message.' }, token);

    let vqd;
    try {
      vqd = await getSessionToken();
    } catch (e) {
      return sendMessage(senderId, { text: '❌ Failed to get session token.' }, token);
    }

    for (const { id, label } of MODELS) {
      const reply = await tryModel(prompt, id, vqd);
      if (reply) {
        const chunks = splitText(reply);
        for (let i = 0; i < chunks.length; i++) {
          const prefix = i === 0 ? `${label}\n\n` : '';
          await sendMessage(senderId, { text: prefix + chunks[i] }, token);
        }
        return;
      }
    }

    await sendMessage(senderId, { text: '❌ All models failed. Try again later.' }, token);
  }
};