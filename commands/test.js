const ai = require('unlimited-ai');
const { sendMessage } = require('../handles/sendMessage');

const MODELS = [
  "gpt-4o-mini", "gpt-4o-free", "gpt-4-turbo-2024-04-09",
  "gpt-4o-2024-08-06", "grok-2", "grok-2-mini", "claude-3-opus-20240229",
  "claude-3-opus-20240229-gcp", "claude-3-sonnet-20240229", "claude-3-5-sonnet-20240620",
  "claude-3-haiku-20240307", "claude-2.1", "gemini-1.5-flash-exp-0827", "gemini-1.5-pro-exp-0827"
];

const historyLimit = 20;

const splitMessage = (msg, max = 1900) => {
  let chunks = [];
  for (let i = 0; i < msg.length; i += max) {
    chunks.push(msg.slice(i, i + max));
  }
  return chunks;
};

const sendChunks = async (id, msg, token) => {
  const chunks = splitMessage(msg);
  for (const chunk of chunks) {
    await sendMessage(id, { text: chunk }, token);
  }
};

let userConversations = {};

module.exports = {
  name: 'test',
  description: 'Interact with OpenAIs ChatGPT',
  usage: '-chatgpt <question>',
  author: 'Coffee',

  async execute(id, args, token) {
    const prompt = args.join(' ') || 'hi';

    if (prompt.toLowerCase() === 'models') {
      await sendChunks(id, `Available Models:\n${MODELS.join(', ')}`, token);
      return;
    }

    userConversations[id] = (userConversations[id] || []).concat(`User: ${prompt}`).slice(-historyLimit);
    const history = `${userConversations[id].join('\n')}\nAI:`;

    for (const model of MODELS) {
      try {
        const response = await ai.generate(model, [{ role: 'user', content: history }]);
        const reply = response.trim();
        userConversations[id].push(`AI: ${reply}`);
        await sendChunks(id, reply, token);
        return;
      } catch {
        continue;
      }
    }

    await sendMessage(id, { text: `Error: All models failed to respond.` }, token);
  }
};