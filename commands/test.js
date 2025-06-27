const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Chat with AI',
  usage: 'ai [message]',
  author: 'coffee',

  async execute(senderId, args, pageAccessToken) {
    const input = args.join(' ');
    if (!input) return sendMessage(senderId, '❗ Please enter a message.');

    const payload = {
      id: senderId,
      mode: 'direct',
      modality: 'chat',
      modelAId: '14e9311c-94d2-40c2-8c54-273947e208b0',
      userMessageId: crypto.randomUUID(),
      modelAMessageId: crypto.randomUUID(),
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: input,
          experimental_attachments: [],
          parentMessageIds: [],
          participantPosition: 'a',
          evaluationSessionId: senderId,
          status: 'pending',
          failureReason: null,
        },
      ],
    };

    try {
      const res = await axios.post(
        'https://lmarena.ai/api/stream/post-to-evaluation/1c0380f7-aecf-4b39-b883-0799f0f26319',
        JSON.stringify(payload),
        {
          headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            Referer: 'https://lmarena.ai/c/1c0380f7-aecf-4b39-b883-0799f0f26319',
            Origin: 'https://lmarena.ai',
            Cookie: [
              '__cf_bm=QZUJFo02l06YkfWTRoacWKrvHOSHbzHX1K1DVuv_bcI-1751059048-1.0.1.1-DvoYk560pC2ddjMP6FuGD0vbLumagaB4OSbWnkIUAwok_lnW2YuyX1LIdKhWRoNc7v3ATrTcaUpPFqT0uNh_OzMFxNXvOu59a4mxZotbFkg',
              'arena-auth-prod-v1=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0ltdHBaQ0k2SWtOVFQwNHhkM05uU0hkRlNFTkNNbGNp...',
              'cf_clearance=3ienByd.l9zzp6_lJRSSFEn0DhUjDAhmwe9z_KKynR8-1751059193-1.2.1.1-rp6ol91DgI3v6fpAJqVKsVuDo5F89rwfBzSKhERNJz3ou...',
              'sidebar=false',
              'ph_phc_LG7IJbVJqBsk584rbcKca0D5lV2vHguiijDrVji7yDM_posthog=%7B%22distinct_id%22%3A%224e71e380-c55a-4a3f-ac33-143e5f31af17%22%2C%22%24sesid%22%3A%5B1751059439690%2C%220197b340-ae84-797f-90d6-8a29e4ee5b43%22%2C1751059050116%5D%2C%22%24epp%22%3Atrue%7D',
            ].join('; '),
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.5',
            Accept: '*/*',
          },
          responseType: 'stream',
        }
      );

      let output = '';
      for await (const chunk of res.data) {
        const text = chunk.toString();
        const match = text.match(/a0:"([^"]+)"/);
        if (match) output += match[1];
      }

      sendMessage(senderId, output.trim() || '⚠️ No response received.');
    } catch (err) {
      console.error('[ai error]', err);
      sendMessage(senderId, '⚠️ Something went wrong with LMarena AI.');
    }
  },
};