const { search, ytmp3 } = require('@lyrra-evanth/src-yt');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches for songs on YouTube and provides audio links.',
  usage: '-ytmusic <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) {
      return sendMessage(id, { text: '❌ Please provide a song title.' }, token);
    }

    const query = args.join(' ');
    const result = await search(query);

    if (!result.status || !result.results?.length) {
      return sendMessage(id, { text: '❌ Could not find the song on YouTube.' }, token);
    }

    const video = result.results[0];
    const url = video.url;

    let mp3;
    try {
      mp3 = await ytmp3(url, '128');
    } catch (err) {
      return sendMessage(id, { text: '❌ Failed to convert audio.' }, token);
    }

    if (!mp3.status || !mp3.download) {
      return sendMessage(id, { text: `❌ Error: ${mp3.result || 'Unknown error occurred.'}` }, token);
    }

    // Send metadata preview
    await sendMessage(id, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title: `🎧 Title: ${mp3.metadata.title}`,
            image_url: mp3.metadata.thumbnail,
            subtitle: `Duration: ${mp3.metadata.duration}`
          }]
        }
      }
    }, token);

    // Send MP3 URL as text
    await sendMessage(id, {
      text: `🔗 MP3 Download:\n${mp3.download}`
    }, token);
  }
};