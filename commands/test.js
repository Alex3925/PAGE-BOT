const axios = require('axios'); const https = require('https'); const { sendMessage } = require('../handles/sendMessage');

module.exports = { name: 'test', description: 'Use DuckDuckGo GPT-4o Mini model for chat', usage: 'duckchat [message]', author: 'mark sombra',

async execute(senderId, args) { const message = args.join(' '); if (!message) return sendMessage(senderId, '❌ Please provide a message.');

const agent = new https.Agent({ family: 4 });
const url = 'https://duckduckgo.com/duckchat/v1/chat';

const headers = {
  'host': 'duckduckgo.com',
  'x-fe-version': 'serp_20250627_165643_ET-96916e1ef6927f416df8',
  'x-fe-signals': 'eyJzdGFydCI6MTc1MTA3NzUzNzg2NiwiZXZlbnRzIjpbXSwiZW5kIjo3MTYzfQ==',
  'sec-ch-ua-platform': '"Android"',
  'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
  'x-vqd-hash-1': 'eyJzZXJ2ZXJfaGFzaGVzIjpbIkpWK3Z1S2xPQlROY3ZBdE1XV2hnRlc4N0p1aXJOUnVDclFhV0Y4cjc1RzA9IiwiUWJVNEx3blE2VW5SL2EyVmdheHFaQWhjKzVDNWxsZEMvSE90bkE0L2xRZz0iXSwiY2xpZW50X2hhc2hlcyI6WyJvTk85T2RLakkzWkhiM1VFVlQxRy9NV3ZDZmVFblUzU3FTalJSQUlZYm1nPSIsIlRiWnRQVUdNdHAzKzdsczFmR0xzYmFxZHZNeGxVTDFRSFY3VTg5NUN4RHc9Il0sInNpZ25hbHMiOnt9LCJtZXRhIjp7InYiOiIzIiwiY2hhbGxlbmdlX2lkIjoiMzgxZTY5OWY1ZDRiYWNkNWUxMjM3NDY5ZGY5M2Q3ZjIzMGVlZTI3NDkxNmQ4ODU2YjUzMWUxMzRiOTY1MzhkZmg4amJ0IiwidGltZXN0YW1wIjoiMTc1MTA3NzUzOTg2NCIsIm9yaWdpbiI6Imh0dHBzOi8vZHVja2R1Y2tnby5jb20iLCJzdGFjayI6IkVycm9yXG5hdCB1ZSAoaHR0cHM6Ly9kdWNrZHVja2dvLmNvbS9kaXN0L3dwbS5jaGF0Ljk2OTE2ZTFlZjY5MjdmNDE2ZGY4LmpzOjE6MjM3MTUpXG5hdCBhc3luYyBodHRwczovL2R1Y2tkdWNrZ28uY29tL2Rpc3Qvd3BtLmNoYXQuOTY5MTZlMWVmNjkyN2Y0MTZkZjguanM6MToyNTkwMiIsImR1cmF0aW9uIjoiMzkifX0=',
  'sec-ch-ua-mobile': '?1',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
  'accept': 'text/event-stream',
  'content-type': 'application/json',
  'sec-gpc': '1',
  'accept-language': 'en-US,en;q=0.8',
  'origin': 'https://duckduckgo.com',
  'referer': 'https://duckduckgo.com/',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'cookie': 'dcm=3; dcs=1',
};

const data = {
  model: 'gpt-4o-mini',
  metadata: {
    toolChoice: {
      NewsSearch: false,
      VideosSearch: false,
      LocalSearch: false,
      WeatherForecast: false,
    }
  },
  messages: [
    { role: 'user', content: message }
  ],
  canUseTools: true
};

try {
  const res = await axios.post(url, data, {
    headers,
    responseType: 'stream',
    httpsAgent: agent
  });

  let reply = '';
  for await (const chunk of res.data) {
    const lines = chunk.toString().split(/\n\n/);
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const json = line.slice(5).trim();
        if (json === '[DONE]') break;
        try {
          const obj = JSON.parse(json);
          if (obj.message) reply += obj.message;
        } catch {}
      }
    }
  }
  if (!reply) reply = '❌ No response from DuckChat.';
  sendMessage(senderId, `🦆 ${reply}`);
} catch (err) {
  console.error(err);
  sendMessage(senderId, '❌ Failed to reach DuckChat.');
}

} };

