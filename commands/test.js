const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const sessions = [
  "ba1a5c15-867a-4caa-b91d-d5ef01503aeb", "448379a9-521d-4a50-9c9a-47e7a9b0227b",
  "6417e57c-ac9f-4b8c-b3bd-1b03c0ddbd49", "07ac79aa-177c-4ed9-a5cd-fa87bda63831",
  "e10a6247-623f-4337-8cd0-bc98972c487f", "fc053908-a0f3-4a9c-ad4a-008105dcc360",
  "a14da8a4-6566-45bd-b589-0f3dff2a1779"
];
let index = 0;
const nextSession = () => sessions[index++ % sessions.length];

const getImage = async (e, token, cache) => {
  const mid = e?.message?.reply_to?.mid || e?.message?.mid;
  try {
    const res = mid && await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token }
    });
    return res?.data?.data?.[0]?.image_data?.url || res?.data?.data?.[0]?.file_url;
  } catch {
    const c = cache?.get(e.sender.id);
    return c && Date.now() - c.timestamp < 3e5 ? c.url : null;
  }
};

const history = {};
const chunk = (t, s = 1900) => t.match(new RegExp(`.{1,${s}}`, 'gs')) || [];

module.exports = {
  name: 'test',
  description: 'Chat with Mocha AI (image supported)',
  usage: 'ask [message]',
  author: 'coffee',

  async execute(id, args, token, event, send, cache) {
    const raw = args.join(' ').trim() || 'Hello';
    const img = await getImage(event, token, cache);
    const input = img ? `${raw}\n\nImage URL: ${img}` : raw;
    const sessionId = nextSession();

    history[id] = [...(history[id] || []), { role: 'user', content: input }].slice(-20);

    const headers = {
      'content-type': 'application/json',
      origin: 'https://digitalprotg-32922.chipp.ai',
      referer: 'https://digitalprotg-32922.chipp.ai/w/chat/',
      cookie: '__Host-next-auth.csrf-token=4723c7d0081a66dd0b572f5e85f5b40c2543881365782b6dcca3ef7eabdc33d6%7C06adf96c05173095abb983f9138b5e7ee281721e3935222c8b369c71c8e6536b; __Secure-next-auth.callback-url=https%3A%2F%2Fapp.chipp.ai; userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5; correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8'
    };

    try {
      const { data } = await axios.post("https://digitalprotg-32922.chipp.ai/api/chat", {
        chatSessionId: sessionId,
        messages: history[id]
      }, { headers });

      const rawText = typeof data === 'string' ? data : JSON.stringify(data);
      const output = [...rawText.matchAll(/0:"(.*?)"/g)].map(m => m[1]).join('').replace(/\\n/g, '\n');

      const tools = data.choices?.[0]?.message?.toolInvocations || [];
      history[id].push({ role: 'assistant', content: output });

      for (const tool of tools) {
        if (tool.toolName === 'generateImage' && tool.state === 'result')
          return send(id, { text: tool.result }, token); // ✅ Only URL sent

        if (tool.toolName === 'browseWeb' && tool.state === 'result') {
          const info = tool.result.answerBox?.answer ||
            tool.result.organic?.map(v => v.snippet).join('\n\n') || 'No info.';
          return send(id, { text: `💬 | Mocha Ai\n─────────────\n${output}\n\nBrowse:\n${info}\n───── >ᴗ< ─────` }, token);
        }
      }

      if (!output) throw new Error('No AI reply.');
      for (const c of chunk(`💬 | Mocha Ai\n─────────────\n${output}\n───── >ᴗ< ─────`))
        await send(id, { text: c }, token);

    } catch (err) {
      console.error('AI error:', err?.response?.data || err.message);
      await send(id, { text: '❎ Error. Please try again.' }, token);
    }
  }
};