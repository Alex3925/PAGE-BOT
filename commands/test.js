const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MODELS = [
  { id: 'gpt-4o-mini', label: '🤖 GPT-4o Mini' },
  { id: 'claude-3-haiku-20240307', label: '🧠 Claude 3 Haiku' },
  { id: 'meta-llama/llama-3.3-70b-instruct-turbo', label: '🦙 LLaMA 3.3 70B' },
  { id: 'mistral-small-3', label: '🌪️ Mistral Small 3' }
];

const splitText = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

async function getSession() {
  const res = await axios.get('https://duckduckgo.com/duckchat/v1/status', {
    headers: { 'x-vqd-accept': '1' }
  });
  return {
    vqd: res.headers['x-vqd-4'] || '',
    feVer: res.headers['x-fe-version'] || '', 
    signals: res.headers['x-fe-signals'] || ''
  };
}

async function tryModel(prompt, { id, label }, session) {
  try {
    const res = await axios.post(
      'https://duckduckgo.com/duckchat/v1/chat',
      {
        model: id,
        metadata: { toolChoice: { NewsSearch: false, VideosSearch: false, LocalSearch: false, WeatherForecast: false } },
        messages: [{ role: 'user', content: prompt }],
        canUseTools: true
      },
      {
        headers: {
          'x-vqd-4': session.vqd,
          'x-fe-version': session.feVer,
          'x-fe-signals': session.signals,
          'x-vqd-hash-1': session.signals,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
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
            const d = JSON.parse(line.slice(6));
            if (d.message) reply += d.message;
            if (d.action === 'success') {
              res.data.destroy();
              return resolve({ text: reply, label });
            }
          }
        }
      });
      res.data.on('error', reject);
    });
  } catch (e) {
    console.warn(`❌ ${label} failed:`, e.message || e);
    return null;
  }
}

module.exports = {
  name: 'test',
  description: 'Talk to Duck.ai with official headers & model fallback',
  usage: 'duckchat <your message>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const prompt = args.join(' ').trim();
    if (!prompt) return sendMessage(senderId, { text: '❓ Please provide a message.' }, token);

    let session;
    try {
      session = await getSession();
    } catch {
      return sendMessage(senderId, { text: '❌ Failed to obtain session token.' }, token);
    }

    for (const model of MODELS) {
      const result = await tryModel(prompt, model, session);
      if (result) {
        const chunks = splitText(result.text);
        for (let i = 0; i < chunks.length; i++) {
          const prefix = i === 0 ? `${result.label}\n\n` : '';
          await sendMessage(senderId, { text: prefix + chunks[i] }, token);
        }
        return;
      }
    }

    await sendMessage(senderId, { text: '❌ All models failed. Try again later.' }, token);
  }
};