const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytsr = require('@distube/ytsr');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches YouTube and sends the MP3 directly.',
  usage: '-test <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: 'Please provide a song title.' }, token);

    const result = (await ytsr(`${args.join(' ')}, official music video`, { limit: 1 })).items[0];
    if (!result?.url || !result?.id) return sendMessage(id, { text: 'Could not find song.' }, token);

    try {
      // Step 1: Fetch info (title and thumbnail) FIRST
      const { data } = await axios.get(`https://c01-h01.cdnframe.com/api/v4/info/${result.id}`, {
        headers: {
          referer: 'https://clickapi.net/',
          origin: 'https://clickapi.net/',
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0'
        }
      });

      // Step 2: Send the generic template immediately
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎧 Title: ${data.title}`,
              image_url: data.thumbnail,
              subtitle: 'Preparing audio, please wait...'
            }]
          }
        }
      }, token);

      // Step 3: Prepare MP3 download
      const mp3List = data?.formats?.audio?.mp3;
      if (!mp3List?.length) return sendMessage(id, { text: 'MP3 not available.' }, token);

      const mp3 = mp3List.find(x => x.quality === 320) || mp3List[0];
      const mp3Url = `https://clickapi.net/dl?token=${mp3.token}`;

      // Step 4: Download MP3 to temp folder
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      const filePath = path.join(tempDir, 'audio.mp3');

      const mp3Response = await axios.get(mp3Url, { responseType: 'arraybuffer' });
      fs.writeFileSync(filePath, Buffer.from(mp3Response.data));

      // Step 5: Upload to Facebook via attachment API
      const form = new FormData();
      form.append('message', JSON.stringify({
        attachment: { type: 'audio', payload: { is_reusable: true } }
      }));
      form.append('filedata', fs.createReadStream(filePath));

      const uploadRes = await axios.post(
        `https://graph.facebook.com/v17.0/me/message_attachments?access_token=${token}`,
        form, { headers: form.getHeaders() }
      );

      const attachmentId = uploadRes.data.attachment_id;

      // Step 6: Send the audio using the attachment_id
      await axios.post(
        `https://graph.facebook.com/v17.0/me/messages?access_token=${token}`,
        {
          recipient: { id },
          message: {
            attachment: {
              type: 'audio',
              payload: { attachment_id: attachmentId }
            }
          }
        }
      );

      fs.unlinkSync(filePath);

    } catch (err) {
      console.error('Test Command Error:', err.message);
      sendMessage(id, { text: '❌ Error: Could not process the song.' }, token);
    }
  }
};