const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'spotify',
  description: 'Search and list Spotify track links.',
  usage: 'spotify [song name]',
  author: 'coffee',

  async execute(senderId, args, pageAccessToken) {
    if (!args.length) {
      return sendMessage(senderId, { text: 'Please enter a song name to search on Spotify.' }, pageAccessToken);
    }

    try {
      const query = encodeURIComponent(args.join(' '));
      const { data } = await axios.get(`https://spotify-play-iota.vercel.app/spotify?query=${query}`);

      if (!Array.isArray(data.trackURLs) || data.trackURLs.length === 0) {
        return sendMessage(senderId, { text: 'No Spotify tracks found for that search.' }, pageAccessToken);
      }

      const list = data.trackURLs
        .slice(0, 10)
        .map((url, i) => `${i + 1}. ${url}`)
        .join('\n');

      return sendMessage(senderId, {
        text: `🎧 Spotify Results for "${args.join(' ')}":\n\n${list}`
      }, pageAccessToken);
    } catch (error) {
      console.error('Spotify Search Error:', error.message || error);
      return sendMessage(senderId, {
        text: 'Sorry, an error occurred while searching Spotify.'
      }, pageAccessToken);
    }
  }
};