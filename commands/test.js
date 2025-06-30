const { ytmp3 } = require('@lyrra-evanth/src-yt');

module.exports = {
  name: 'testmp3',
  description: 'Downloads MP3 info from YouTube and logs it.',
  usage: '-testmp3',
  author: 'you',

  async execute() {
    try {
      const result = await ytmp3('https://youtu.be/Kqt5zb3dNTM');
      console.log(result);
    } catch (error) {
      console.error('❌ Error:', error.message || error);
    }
  }
};