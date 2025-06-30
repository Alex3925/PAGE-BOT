const { search, ytdlv2 } = require('@lyrra-evanth/src-yt');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches for songs on YouTube and provides MP3/MP4 download links.',
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

    let media;
    try {
      // Default quality fallback (128 for audio or 360 for video)
      media = await ytdlv2(url); 
    } catch (err) {
      return sendMessage(id, { text: '❌ Failed to download media.' }, token);
    }

    if (!media.status || !media.download) {
      return sendMessage(id, { text: `❌ Error: ${media.result || 'Unknown error'}` }, token);
    }

    const meta = media.metadata;

    // Send preview card
    await sendMessage(id, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title: `🎧 Title: ${meta.title}`,
            image_url: meta.thumbnail,
            subtitle: `Duration: ${meta.duration}`
          }]
        }
      }
    }, token);

    // Determine type by file extension
    const ext = media.download.split('.').pop().toLowerCase();
    const type = ext === 'mp3' ? 'audio' : 'video';

    // Send media file
    await sendMessage(id, {
      attachment: {
        type,
        payload: { url: media.download }
      }
    }, token);
  }
};