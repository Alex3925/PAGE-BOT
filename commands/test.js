const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytsr = require('@distube/ytsr');
const { sendMessage } = require('../handles/sendMessage');
const FormData = require('form-data');

module.exports = {
  name: 'test',
  description: 'Searches YouTube and sends the MP3 directly.',
  usage: '-test <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: 'Error: Please provide a song title.' }, token);

    // Step 1: Search YouTube
    const result = (await ytsr(`${args.join(' ')}, official music video`, { limit: 1 })).items[0];
    if (!result?.url || !result?.id) return sendMessage(id, { text: 'Error: Could not find song.' }, token);

    try {
      // Step 2: Get MP3 token
      const { data } = await axios.get(`https://c01-h01.cdnframe.com/api/v4/info/${result.id}`, {
        headers: {
          referer: 'https://clickapi.net/',
          origin: 'https://clickapi.net/',
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0'
        }
      });

      const mp3List = data?.formats?.audio?.mp3;
      if (!mp3List?.length) return sendMessage(id, { text: 'Error: MP3 not available.' }, token);

      const mp3 = mp3List.find(x => x.quality === 320) || mp3List[0];
      const mp3Url = `https://clickapi.net/dl?token=${mp3.token}`;

      // Step 3: Download MP3
      const filePath = path.join(__dirname, '../temp/audio.mp3');
      const writer = fs.createWriteStream(filePath);
      const response = await axios.get(mp3Url, { responseType: 'stream' });
      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Step 4: Upload MP3 to Facebook
      const form = new FormData();
      form.append('message', ' ');
      form.append('filedata', fs.createReadStream(filePath));
      const uploadRes = await axios.post(
        `https://graph.facebook.com/v23.0/me/messages`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`
          },
          params: { recipient: JSON.stringify({ id }) }
        }
      );

      // Step 5: Send info card (optional)
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎧 Title: ${data.title}`,
              image_url: data.thumbnail,
              subtitle: 'Audio uploaded and sent directly.'
            }]
          }
        }
      }, token);

      // Clean up
      fs.unlinkSync(filePath);

    } catch (err) {
      console.error(err);
      sendMessage(id, { text: '❌ Error: Unable to process request.' }, token);
    }
  }
};