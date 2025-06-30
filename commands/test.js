const axios = require('axios');
const ytsr = require('@distube/ytsr');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches YouTube and sends the lowest quality audio via Facebook',
  usage: '-test <song>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: '❌ Please provide a song title.' }, token);

    try {
      // Step 1: Search YouTube
      const result = (await ytsr(`${args.join(' ')}, official music video`, { limit: 1 })).items[0];
      if (!result?.id) return sendMessage(id, { text: '❌ No YouTube results found.' }, token);

      // Step 2: Get MP3 info from API
      const { data } = await axios.get(`https://c01-h01.cdnframe.com/api/v4/info/${result.id}`, {
        headers: {
          'referer': 'https://clickapi.net/',
          'origin': 'https://clickapi.net/',
          'accept': 'application/json',
          'user-agent': 'Mozilla/5.0'
        }
      });

      const mp3List = data?.formats?.audio?.mp3;
      if (!mp3List?.length) return sendMessage(id, { text: '❌ MP3 formats not available.' }, token);

      // Step 3: Pick lowest quality MP3 (64 kbps)
      const sorted = mp3List.sort((a, b) => a.quality - b.quality);
      const mp3 = sorted[0];
      const downloadUrl = `https://clickapi.net/dl?token=${mp3.token}`;

      // Step 4: Download MP3 to temp file
      const filename = path.resolve(__dirname, `temp-${Date.now()}.mp3`);
      const writer = fs.createWriteStream(filename);
      const response = await axios.get(downloadUrl, { responseType: 'stream' });
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Step 5: Send info card
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎧 ${data.title}`,
              image_url: data.thumbnail,
              subtitle: `Sending ${mp3.quality}kbps audio...`
            }]
          }
        }
      }, token);

      // Step 6: Upload audio file via form-data
      const form = new FormData();
      form.append('recipient', JSON.stringify({ id }));
      form.append('message', JSON.stringify({
        attachment: {
          type: 'audio',
          payload: {}
        }
      }));
      form.append('filedata', fs.createReadStream(filename));

      await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, form, {
        headers: form.getHeaders()
      });

      // Step 7: Delete temp file
      fs.unlinkSync(filename);

    } catch (err) {
      console.error('❌ Error:', err.message);
      return sendMessage(id, { text: '❌ Something went wrong while processing the audio.' }, token);
    }
  }
};