const axios = require('axios');
const ytsr = require('@distube/ytsr');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches for songs on YouTube and provides audio links.',
  usage: '-test <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: 'Error: Please provide a song title.' }, token);

    // Step 1: Search for the top YouTube result
    const result = (await ytsr(`${args.join(' ')}, official music video`, { limit: 1 })).items[0];
    if (!result?.url || !result?.id) return sendMessage(id, { text: 'Error: Could not find song.' }, token);

    try {
      // Step 2: Get MP3 tokens from the new CDN API
      const { data } = await axios.get(`https://c01-h01.cdnframe.com/api/v4/info/${result.id}`, {
        headers: {
          'referer': 'https://clickapi.net/',
          'origin': 'https://clickapi.net/',
          'accept': 'application/json',
          'user-agent': 'Mozilla/5.0'
        }
      });

      const mp3List = data?.formats?.audio?.mp3;
      if (!mp3List || !mp3List.length) return sendMessage(id, { text: 'Error: MP3 not available.' }, token);

      const mp3 = mp3List.find(x => x.quality === 320) || mp3List[0];
      const mp3Url = `https://clickapi.net/dl?token=${mp3.token}`;

      // Step 3: Send audio info card
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎧 Title: ${data.title}`,
              image_url: data.thumbnail,
              subtitle: 'Audio ready. Tap below to listen.'
            }]
          }
        }
      }, token);

      // Step 4: Send actual audio file link
      sendMessage(id, {
        attachment: {
          type: 'audio',
          payload: { url: mp3Url }
        }
      }, token);

    } catch (err) {
      console.error(err);
      return sendMessage(id, { text: 'Error: Failed to fetch MP3.' }, token);
    }
  }
};