const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'spotify',
  description: 'Play a song from Spotify',
  usage: 'spotify [song title]',
  author: 'coffee',

  async execute(senderId, args, token) {
    try {
      await sendMessage(senderId, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: '🎧 Downloading audio...',
              subtitle: 'Please wait a moment.'
            }]
          }
        }
      }, token);

      const q = args.join(' ');
      const p = Buffer.from('c2VhcmNo', 'base64').toString();
      const u = Buffer.from('aHR0cHM6Ly9oaXJvc2hpLWFwaS5vbnJlbmRlci5jb20vdGlrdG9rL3Nwb3RpZnk=', 'base64').toString();

      const { data } = await axios.get(u, { params: { [p]: q } });
      const audio = data?.[0]?.download;

      sendMessage(senderId, audio ? {
        attachment: { type: 'audio', payload: { url: audio, is_reusable: true } }
      } : { text: '❌ No song found.' }, token);

    } catch {
      sendMessage(senderId, { text: '❌ Failed to fetch song.' }, token);
    }
  }
};