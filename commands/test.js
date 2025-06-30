const axios = require('axios');
const ytsr = require('@distube/ytsr');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches YouTube and sends an audio version via Facebook',
  usage: '-test <song>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: '❌ Please provide a song title.' }, token);

    try {
      // 1. Search YouTube
      const result = (await ytsr(`${args.join(' ')}, official music video`, { limit: 1 })).items[0];
      if (!result?.id) return sendMessage(id, { text: '❌ No YouTube result found.' }, token);

      // 2. Get MP3 info
      const { data } = await axios.get(`https://c01-h01.cdnframe.com/api/v4/info/${result.id}`, {
        headers: {
          referer: 'https://clickapi.net/',
          origin: 'https://clickapi.net/',
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0'
        }
      });

      const mp3List = data?.formats?.audio?.mp3;
      if (!mp3List?.length) return sendMessage(id, { text: '❌ MP3 not available.' }, token);

      // 3. Use any available MP3 (just take the first one)
      const mp3 = mp3List[0];
      const downloadUrl = `https://clickapi.net/dl?token=${mp3.token}`;

      // 4. Download MP3
      const filePath = path.resolve(__dirname, `temp-${Date.now()}.mp3`);
      const writer = fs.createWriteStream(filePath);
      const audioStream = await axios.get(downloadUrl, { responseType: 'stream' });
      audioStream.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // 5. Send info card
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎵 ${data.title}`,
              image_url: data.thumbnail,
              subtitle: `Sending audio file...`
            }]
          }
        }
      }, token);

      // 6. Upload MP3 to Messenger
      const form = new FormData();
      form.append('recipient', JSON.stringify({ id }));
      form.append('message', JSON.stringify({
        attachment: { type: 'audio', payload: {} }
      }));
      form.append('filedata', fs.createReadStream(filePath));

      await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, form, {
        headers: form.getHeaders()
      });

      // 7. Clean up temp file
      fs.unlinkSync(filePath);

    } catch (err) {
      console.error('❌ Error:', err.message);
      return sendMessage(id, { text: '❌ Failed to send audio.' }, token);
    }
  }
};