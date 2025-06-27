const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Send prompt to lmarena.ai create-evaluation endpoint',
  usage: 'ai <your message>',
  author: 'Mark sombra',

  async execute(senderId, args) {
    const userPrompt = args.join(' ') || 'hello';

    const payload = {
      id: '72987daa-89e9-41aa-a28e-40f884cd3d1b',
      mode: 'direct',
      modelAId: '14e9311c-94d2-40c2-8c54-273947e208b0',
      userMessageId: 'a87a5ae2-b149-42ed-bf47-2b4b2cff8db2',
      modelAMessageId: 'f19b036a-4650-4e51-bbb2-21dc2b27461c',
      messages: [
        {
          id: 'a87a5ae2-b149-42ed-bf47-2b4b2cff8db2',
          role: 'user',
          content: userPrompt,
          experimental_attachments: [],
          parentMessageIds: [],
          participantPosition: 'a',
          modelId: null,
          evaluationSessionId: '72987daa-89e9-41aa-a28e-40f884cd3d1b',
          status: 'pending',
          failureReason: null
        },
        {
          id: 'f19b036a-4650-4e51-bbb2-21dc2b27461c',
          role: 'assistant',
          content: '',
          experimental_attachments: [],
          parentMessageIds: ['a87a5ae2-b149-42ed-bf47-2b4b2cff8db2'],
          participantPosition: 'a',
          modelId: '14e9311c-94d2-40c2-8c54-273947e208b0',
          evaluationSessionId: '72987daa-89e9-41aa-a28e-40f884cd3d1b',
          status: 'pending',
          failureReason: null
        }
      ],
      modality: 'chat'
    };

    try {
      const response = await axios.post('https://lmarena.ai/api/stream/create-evaluation', payload, {
        headers: {
          'Host': 'lmarena.ai',
          'Content-Type': 'text/plain;charset=UTF-8',
          'Content-Length': JSON.stringify(payload).length.toString(),
          'sec-ch-ua-platform': '"Android"',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
          'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'sec-ch-ua-mobile': '?1',
          'accept': '/',
          'sec-gpc': '1',
          'accept-language': 'en-US,en;q=0.5',
          'origin': 'https://lmarena.ai',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
          'referer': 'https://lmarena.ai/',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'priority': 'u=1, i',
          'cookie': [
            'arena-auth-prod-v1=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0ltdHBaQ0k2SWtOVFQwNHhkM05uU0hkRlNFTkNNbGNpTENKMGVYQWlPaUpLVjFRaWZRLmV5SnBjM01pT2lKb2RIUndjem92TDJoMWIyZDZiMlZ4ZW1OeVpIWnJkM1IyYjJScExuTjFjR0ZpWVhObExtTnZMMkYxZEdndmRqRWlMQ0p6ZFdJaU9pSmhOVFZrTTJFME9DMHpOamN6TFRRMFpqY3RZVFJpTlMweU9ETmxPRFkwWWpjek0yTWlMQ0poZFdRaU9pSmhkWFJvWlc1MGFXTmhkR1ZrSWl3aVpYaHdJam94TnpVeE1EWXlOalkwTENKcFlYUWlPakUzTlRFd05Ua3dOalFzSW1WdFlXbHNJam9pSWl3aWNHaHZibVVpT2lJaUxDSmhjSEJmYldWMFlXUmhkR0VpT250OUxDSjFjMlZ5WDIxbGRHRmtZWFJoSWpwN0ltbGtJam9pTkdVM01XVXpPREF0WXpVMVlTMDBZVE5tTFdGak16TXRNVFF6WlRWbU16RmhaakUzSW4wc0luSnZiR1VpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWVdGc0lqb2lZV0ZzTVNJc0ltRnRjaUk2VzNzaWJXVjBhRzlrSWpvaVlXNXZibmx0YjNWeklpd2lkR2x0WlhOMFlXMXdJam94TnpVeE1EVTVNRFkwZlYwc0luTmxjM05wYjI1ZmFXUWlPaUptTVRsaU1qTTVZeTB3WXpnMExUUmpNREV0T1dJM05TMWpORFpqWldFMk5UVTJZMkVpTENKcGMxOWhibTl1ZVcxdmRYTWlPblJ5ZFdWOS4tQzZ4c21yUlVkWDZsMlFoemVQSGZpSTN1RDZWb3BHS0ItV21pOWIxdWtJIiwidG9rZW5fdHlwZSI6ImJlYXJlciIsImV4cGlyZXNfaW4iOjM2MDAsImV4cGlyZXNfYXQiOjE3NTEwNjI2NjQsInJlZnJlc2hfdG9rZW4iOiI0aG9sdmk2d2lzaXAiLCJ1c2VyIjp7ImlkIjoiYTU1ZDNhNDgtMzY3My00NGY3LWE0YjUtMjgzZTg2NGI3MzNjIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZW1haWwiOiIiLCJwaG9uZSI6IiIsImxhc3Rfc2lnbl9pbl9hdCI6IjIwMjUtMDYtMjdUMjE6MTc6NDQuMTkzMjQ0MTQ1WiIsImFwcF9tZXRhZGF0YSI6e30sInVzZXJfbWV0YWRhdGEiOnsiaWQiOiI0ZTcxZTM4MC1jNTVhLTRhM2YtYWMzMy0xNDNlNWYzMWFmMTcifSwiaWRlbnRpdGllcyI6W10sImNyZWF0ZWRfYXQiOiIyMDI1LTA2LTI3VDIxOjE3OjQ0LjE5MTc2MVoiLCJ1cGRhdGVkX2F0IjoiMjAyNS0wNi0yN1QyMToxNzo0NC4xOTQ3MzJaIiwiaXNfYW5vbnltb3VzIjp0cnVlfX0',
            'sidebar=false',
            '__cf_bm=_lzYrotZIbF4p2SuOKlTL7GcyOQ4v5T8xatcecfAwd8-1751060715-1.0.1.1-dAnnJGt2mCtgTPy4wCAK7ehb_TcZFL1v4aeo_7aNVT85o.XsaN3lnM3APqwvgkTMcHY1iM0LnR.o9Mk.igKmS8M9lXGrFyWCNngAMok8lbY',
            'cf_clearance=2ZVWFzBpBUwQzOgU2q45MelnaCoic_.FlXC_BIR3JJE-1751060717-1.2.1.1-NGeE22yuU4.oOQYSm31hOEuWctlWb0oKh.VRVaby.e_op7Xm2FrPgk.4GWQpM5DGUEplhcoh55ZFkWlPyPShtFTsQ4_poIK.JLYB.CHNsU69x8bZ6cZ.VdvcTudpS_NSxECknqniCus0HTwX64y360CFPx4YOGgl3A2ZIuhAMge2nFdGvwep_.UNfMdKGROJoHMB4ffgdbgLfGeBprtMAnfwkCwcXnRLNqETARQfu7TJfWXQ84MQS9A2lvgxDWWnTbqOnAH6DthXmPukvxwh9cU4glomgY2rZKJrSrUFOJslNPyEnimpl2QQbIWxEZudCijwh.sxfzAWF5nXc7PNaZawD6gm_q5JfIixmwFLZBQ'
          ].join('; ')
        },
        responseType: 'stream'
      });

      let finalText = '';
      response.data.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('a0:')) {
          const match = line.match(/a0:"(.*?)"/);
          if (match && match[1]) {
            finalText += match[1];
          }
        }
      });

      response.data.on('end', () => {
        sendMessage(senderId, finalText || '✅ Done, but no content returned.');
      });

    } catch (err) {
      console.error('[AI Error]', err?.response?.data || err.message);
      sendMessage(senderId, '❌ Failed to get a response.');
    }
  }
};