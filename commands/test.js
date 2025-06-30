const ytdl = require("node-yt-dl");

module.exports = {
  name: "mp3",
  description: "Downloads MP3 from a YouTube link.",
  usage: "-mp3 <YouTube URL>",
  async execute(message, args, sendMessage) {
    const url = args[0];
    if (!url) return sendMessage(message.chat.id, "❌ Please provide a YouTube URL.");

    try {
      const result = await ytdl.mp3(url);
      const { title, url: downloadUrl } = result;
      await sendMessage(message.chat.id, `🎵 *${title}*\n🔗 MP3: ${downloadUrl}`);
    } catch (error) {
      await sendMessage(message.chat.id, "❌ Failed to get MP3.\n" + error.message);
    }
  }
};