const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'spotify',
  description: 'Search and play a Spotify song.',
  usage: 'spotify [song name]',
  author: 'coffee',

  async execute(senderId, args, pageAccessToken) {
    if (!args.length) {
      return sendMessage(senderId, { text: 'Please provide a song name.' }, pageAccessToken);
    }

    try {
      const query = encodeURIComponent(args.join(' '));
      const res = await axios.get(`https://spotify-play-iota.vercel.app/spotify?query=${query}`);

      const { title, url, thumbnail } = res.data || {};
      if (!url) {
        return sendMessage(senderId, { text: 'Sorry, no results found for that song.' }, pageAccessToken);
      }

      await sendMessage(senderId, {
        text: `🎵 Now playing: ${title}`,
        quick_replies: [],
      }, pageAccessToken);

      await sendMessage(senderId, {
        attachment: {
          type: 'audio',
          payload: {
            url,
            is_reusable: true
          }
        }
      }, pageAccessToken);
      
    } catch (error) {
      console.error('Spotify Error:', error?.message);
      sendMessage(senderId, { text: 'Sorry, there was an error fetching the song.' }, pageAccessToken);
    }
  }
};