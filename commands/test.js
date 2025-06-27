const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Ask LMarena AI a question',
  usage: 'ai [your message]',
  author: 'System',

  async execute(senderId, args, pageAccessToken) {
    if (!args.length) return sendMessage(senderId, '❌ Please provide a message.', pageAccessToken);

    const sessionId = '1c0380f7-aecf-4b39-b883-0799f0f26319';
    const userMessageId = senderId;

    const payload = {
      id: sessionId,
      mode: 'direct',
      modelAId: '14e9311c-94d2-40c2-8c54-273947e208b0',
      userMessageId,
      modelAMessageId: '3f38cc07-d27d-4bdc-9255-e7f33d5cc63a',
      messages: [
        {
          id: userMessageId,
          role: 'user',
          content: args.join(' '),
          experimental_attachments: [],
          parentMessageIds: [],
          participantPosition: 'a',
          modelId: null,
          evaluationSessionId: sessionId,
          status: 'pending',
          failureReason: null
        }
      ],
      modality: 'chat'
    };

    try {
      const response = await axios.post(
        `https://lmarena.ai/api/stream/post-to-evaluation/${sessionId}`,
        JSON.stringify(payload),
        {
          responseType: 'stream',
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
            'origin': 'https://lmarena.ai',
            'referer': `https://lmarena.ai/c/${sessionId}`,
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
            'cookie': [
              '__cf_bm=QZUJFo02l06YkfWTRoacWKrvHOSHbzHX1K1DVuv_bcI-1751059048-1.0.1.1-DvoYk560pC2ddjMP6FuGD0vbLumagaB4OSbWnkIUAwok_lnW2YuyX1LIdKhWRoNc7v3ATrTcaUpPFqT0uNh_OzMFxNXvOu59a4mxZotbFkg',
              'arena-auth-prod-v1=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0ltdHBaQ0k2SWtOVFQw...',
              'cf_clearance=3ienByd.l9zzp6_lJRSSFEn0DhUjDAhmwe9z_KKynR8-1751059193-1.2.1.1-rp6ol91DgI3v6fpAJqVKsVuDo5F89rwfBzSKhERNJz3ouCTrzB3mBah.z.SzalPpFS7KrYwGYEBVKCAYAzc6WJQYPzYsDDnN_f9oEmSMvQcZMKOfiDxlsVzhl2pSoxfheh1V5NK26EHbZTcOUCMYzCu50zbb5KzP1OOZhRfijlUKthA4owdgX8CkuhFG1LE2vCLSW3OKmcmi6Iez4KvuwAh4WwNvNy9SrgzzyG.DckqAjFQxEs8LnNyjYooSGB2stvhTBkqmhWdCbAVDWRlgDpNb.AYrelnrkHR3s0MdQqs.McZE5tvA1N2tlKKsD8Wpru6Y.wYMEE5W0KDIAjP2et4U4ZMF0acIwxH.nZen.F.t0j2X4RmvIEhOX0isLpjQ',
              'sidebar=false',
              'ph_phc_LG7IJbVJqBsk584rbcKca0D5lV2vHguiijDrVji7yDM_posthog=%7B%22distinct_id%22%3A%224e71e380-c55a-4a3f-ac33-143e5f31af17%22%2C%22%24sesid%22%3A%5B1751059439690%2C%220197b340-ae84-797f-90d6-8a29e4ee5b43%22%2C1751059050116%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22https%3A%2F%2Fwww.kdnuggets.com%2F%22%2C%22u%22%3A%22https%3A%2F%2Flmarena.ai%2F%22%7D%7D'
            ].join('; ')
          }
        }
      );

      let reply = '';
      for await (const chunk of response.data) {
        const text = chunk.toString();
        const matches = text.match(/a0:"([^"]+)"/g);
        if (matches) reply += matches.map(m => m.slice(4, -1)).join('');
      }

      return sendMessage(senderId, reply.trim() || '⚠️ No response received.', pageAccessToken);
    } catch (err) {
      console.error('LMarena Error:', err.message);
      return sendMessage(senderId, '❌ Failed to get a response from LMarena.', pageAccessToken);
    }
  }
};