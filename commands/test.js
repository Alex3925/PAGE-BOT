const ytdl = require('node-yt-dl');

module.exports = {
  name: 'testmp3',
  description: 'Downloads MP3 info from YouTube and logs it.',
  usage: '-testmp3',
  author: 'you',

  async execute() {
    try {
      const result = await ytdl.mp3('https://youtu.be/OqEc_169ywY');
      console.log(result);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
};