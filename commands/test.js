const ytdl = require("node-yt-dl");
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: "mp3",
  description: "Downloads MP3 from a YouTube link.",
  usage: "-mp3 <YouTube URL>",
  author: "yourname",

  async execute(message, args) {
    const url = args[0];
    if (!url) return sendMessage(message, "❌ Please provide a YouTube URL.");

    try {
      const result = await ytdl.mp3(url);
      const { title, url: downloadUrl } = result;

      return sendMessage(message, `🎵 *${title}*\n\n🔗 MP3 Download:\n${downloadUrl}`);
    } catch (error) {
      return sendMessage(message, `❌ Failed to retrieve MP3.\n\nError: ${error.message}`);
    }
  }
};