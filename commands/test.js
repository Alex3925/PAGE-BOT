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
      // Convert the entire result object to a readable JSON string
      const resultText = "✅ MP3 Result:\n\n" + JSON.stringify(result, null, 2);
      return sendMessage(message, resultText);
    } catch (error) {
      return sendMessage(message, `❌ Failed to retrieve MP3.\n\nError: ${error.message}`);
    }
  }
};