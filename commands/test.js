const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'spotify',
  description: 'Search and play a Spotify song.',
  usage: 'spotify [song name]',
  author: 'coffee',

  async execute(senderId, args, pageAccessToken) {
    if (!args.length) {
      return sendMessage(senderId, { text: 'Please provide a song name to search.' }, pageAccessToken);
    }

    try {
      const query = encodeURIComponent(args.join(' '));
      const { data } = await axios.get(`https://spotify-play-iota.vercel.app/spotify?query=${query}`);

      const firstTrack = data?.trackURLs?.[0];
      if (!firstTrack) {
        return sendMessage(senderId, { text: 'No track found for your query.' }, pageAccessToken);
      }

      // Use external service to convert Spotify URL to MP3 — replace this with actual logic
      const convertUrl = `https://spotify-downloader-api.vercel.app/api/download?url=${encodeURIComponent(firstTrack)}`;
      const { data: downloadData } = await axios.get(convertUrl);

      const audioUrl = downloadData?.audio;
      if (!audioUrl) {
        return sendMessage(senderId, { text: 'Could not retrieve MP3 from Spotify link.' }, pageAccessToken);
      }

      return sendMessage(senderId, {
        attachment: {
          type: 'audio',
          payload: {
            url: audioUrl,
            is_reusable: true
          }
        }
      }, pageAccessToken);

    } catch (error) {
      console.error('Spotify Error:', error.message || error);
      return sendMessage(senderId, {
        text: 'Sorry, there was an error processing your request.'
      }, pageAccessToken);
    }
  }
};