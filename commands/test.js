const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MODELS = [
  { id: 'gpt-4o-mini-2024-07-18', label: '🤖 GPT‑4o Mini' },
  { id: 'claude-3-haiku-20240307', label: '🧠 Claude 3 Haiku' },
  { id: 'meta-llama/llama-3.3-70b-instruct-turbo', label: '🦙 LLaMA 3.3 70B' },
  { id: 'mistral-small-3', label: '🌪️ Mistral Small 3' }
];

const splitText = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

async function getSessionHeaders() {
  const res = await axios.get('https://duckduckgo.com/duckchat/v1/status', {
    headers: { 'x-vqd-accept': '1' }
  });
  return {
    'x-vqd-4': res.headers['x-vqd-4'],
    'x-fe-version': res.headers['x-fe-version'] || 'serp_20250627_165643_ET-96916e1ef6927f416df8',
    'x-fe-signals': res.headers['x-fe-signals'] || ''
  };
}

async function tryModel(prompt, model, headers) {
  try {
    const res = await axios.post(
      'https://duckduckgo.com/duckchat/v1/chat',
      {
        model,
        metadata: { toolChoice: { NewsSearch: false, VideosSearch: false, LocalSearch: false, WeatherForecast: false } },
        messages: [{ role: 'user', content: prompt }],
        canUseTools: true
      },
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'sec-ch-ua-platform': '"Android"',
          'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'sec-ch-ua-mobile': '?1',
          // add other required headers here (user-agent, origin, etc.)
        },
        responseType: 'stream'
      }
    );

    return new Promise((resolve, reject) => {
      let reply = '';
      res.data.on('data', chunk => {
        for (const line of chunk.toString().split('\n')) {
          if (line.startsWith('data: ')) {
            const obj = JSON.parse(line.slice(6));
            if (obj.message) reply += obj.message;
            if (obj.action === 'success') {
              res.data.destroy();
              return resolve(reply);
            }
          }
        }
      });
      res.data.on('error', reject);
    });
  } catch (err) {
    console.warn(`❌ ${model} failed:`, err.message);
    return null;
  }
}

module.exports = {
  name: 'test',
  description: 'Chat with DuckChat API across multiple models',
  usage: 'duckchat <your message>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: '❓ Please provide a message.' }, token);

    let headers;
    try {
      headers = await getSessionHeaders();
    } catch (e) {
      return sendMessage(senderId, { text: '❌ Failed to obtain session.' }, token);
    }

    for (const { id, label } of MODELS) {
      const reply = await tryModel(prompt, id, headers);
      if (reply) {
        const parts = splitText(reply);
        for (let i = 0; i < parts.length; i++) {
          const prefix = i === 0 ? `${label}\n\n` : '';
          await sendMessage(senderId, { text: prefix + parts[i] }, token);
        }
        return;
      }
    }

    await sendMessage(senderId, { text: '❌ All models failed.' }, token);
  }
};