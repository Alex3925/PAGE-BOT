const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'spotify',
  description: 'Play a song from Spotify',
  usage: 'spotify [song title]',
  author: 'coffee',

  async execute(senderId, args, token) {
    try {
      const { data } = await axios.get('https://hiroshi-api.onrender.com/tiktok/spotify', {
        params: { search: args.join(' ') }
      });
      const url = data?.[0]?.download;
      sendMessage(senderId, url ? {
        attachment: { type: 'audio', payload: { url, is_reusable: true } }
      } : { text: '❌ No song found.' }, token);
    } catch {
      sendMessage(senderId, { text: '❌ Failed to fetch song.' }, token);
    }
  }
};