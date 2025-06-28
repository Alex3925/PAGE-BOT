const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const splitText = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];

async function duckChatPrompt(prompt, token) {
  const headers = {
    'x-fe-version': 'serp_20250627_165643_ET-96916e1ef6927f416df8',
    'x-fe-signals': 'eyJzdGFydCI6MTc1MTA3NzA5MDgwMywiZXZlbnRzIjpbXSwiZW5kIjo4ODU1fQ==',
    'x-vqd-hash-1': 'eyJzZXJ2ZXJfaGFzaGVzIjpbIm1JUEo4RE1FSThEeVkrZnAybUN6aTRzVHlXM2dyYmdweklPTHRhSnFjelE9IiwiQit4UFVkcktMZTBtWE9scGw4bXlPRTZnMGNhRkFFNXY5dWxxUkhBYjJoST0iXSwiY2xpZW50X2hhc2hlcyI6WyJvTk85T2RLakkzWkhiM1VFVlQxRy9NV3ZDZmVFblUzU3FTalJSQUlZYm1nPSIsIklFMkJ4QkY5dXNYQUYrVmtwa2x0UXc4TFhvSjlvcnhYNXUvS2ZKUk0wNEE9Il0sInNpZ25hbHMiOnt9LCJtZXRhIjp7InYiOiIzIiwiY2hhbGxlbmdlX2lkIjoiYzM3NmE1YjJhNThjMzM0NjU4NjNiNmQ4YTE0ODM3MzZmNzRmMjk3YjkzN2JlM2QwMDQyMDc2ODdiN2Q3NGNhYWg4amJ0IiwidGltZXN0YW1wIjoiMTc1MTA3NzA5Mjg3OCIsIm9yaWdpbiI6Imh0dHBzOi8vZHVja2R1Y2tnby5jb20iLCJzdGFjayI6IkVycm9yXG5hdCB1ZSAoaHR0cHM6Ly9kdWNrZHVja2dvLmNvbS9kaXN0L3dwbS5jaGF0Ljk2OTE2ZTFlZjY5MjdmNDE2ZGY4LmpzOjE6MjM3MTUpXG5hdCBhc3luYyBodHRwczovL2R1Y2tkdWNrZ28uY29tL2Rpc3Qvd3BtLmNoYXQuOTY5MTZlMWVmNjkyN2Y0MTZkZjguanM6MToyNTkwMiIsImR1cmF0aW9uIjoiMzYifX0=',
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    'sec-ch-ua-mobile': '?1',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    'accept': 'text/event-stream',
    'content-type': 'application/json',
    'sec-gpc': '1',
    'accept-language': 'en-US,en;q=0.8',
    'origin': 'https://duckduckgo.com',
    'referer': 'https://duckduckgo.com/',
    'cookie': 'dcm=3; dcs=1', // ✅ cookies included here
  };

  const body = {
    model: 'gpt-4o-mini',
    metadata: {
      toolChoice: {
        NewsSearch: false,
        VideosSearch: false,
        LocalSearch: false,
        WeatherForecast: false
      }
    },
    messages: [
      { role: 'user', content: prompt },
      {
        role: 'assistant',
        content: '',
        parts: [{ type: 'text', text: 'Hello! How can I assist you today?' }]
      },
      { role: 'user', content: 'I\'m bored' }
    ],
    canUseTools: true
  };

  const res = await axios.post('https://duckduckgo.com/duckchat/v1/chat', body, {
    headers,
    responseType: 'stream'
  });

  return new Promise((resolve, reject) => {
    let reply = '';
    res.data.on('data', chunk => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.message) reply += json.message;
            if (json.action === 'success') res.data.destroy();
          } catch (e) {}
        }
      }
    });
    res.data.on('end', () => resolve(reply));
    res.data.on('error', reject);
  });
}

module.exports = {
  name: 'test',
  description: 'Chat using DuckDuckGo GPT‑4o‑Mini',
  usage: 'duckchat <message>',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage) {
    const prompt = args.join(' ').trim();
    if (!prompt) return await sendMessage(senderId, { text: '❓ Provide a message.' }, token);

    try {
      const response = await duckChatPrompt(prompt, token);
      for (const part of splitText(response)) {
        await sendMessage(senderId, { text: part }, token);
      }
    } catch (err) {
      console.error('❌ DuckChat error:', err.message || err);
      await sendMessage(senderId, { text: '❌ Failed to reach DuckDuckGo GPT‑4o‑Mini.' }, token);
    }
  }
};