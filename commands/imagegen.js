const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

const key = 'b59784be-020d-4a15-bb50-3cfb0f1ae5b0';
const decode = str => Buffer.from(str, [98,97,115,101,54,52].map(c => String.fromCharCode(c)).join('')).toString();

module.exports = {
  name: 'imagegen',
  description: 'Generate images via prompt using Flux.',
  usage: '-imagegen [prompt]',
  author: 'coffee',

  execute: async (senderId, args, pageAccessToken) => {
    if (!args.length) return sendMessage(senderId, { text: 'Please provide a prompt.' }, pageAccessToken);

    const prompt = encodeURIComponent(args.join(' ').trim());

    const url = decode('aHR0cHM6Ly9pbWFnZS5wb2xsaW5hdGlvbnMuYWkvcHJvbXB0LyR7cHJvbXB0fT9tb2RlbD1mbHV4JndpZHRoPTEwMjQmaGVpZ2h0PTEwMjQmbm9sb2dvPXRydWU=')
      .replace('${prompt}', prompt);

    try {
      const img = await axios.get(url, { responseType: 'arraybuffer' });
      const file = path.join(__dirname, 'tmp.jpg');
      fs.writeFileSync(file, Buffer.from(img.data));

      const form = new FormData();
      form.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
      form.append('filedata', fs.createReadStream(file));

      const upload = await axios.post(
        `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
        form, { headers: form.getHeaders() }
      );

      const attachmentId = upload.data.attachment_id;
      await axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`, {
        recipient: { id: senderId },
        message: { attachment: { type: 'image', payload: { attachment_id: attachmentId } } }
      });

      fs.unlinkSync(file);
    } catch (e) {
      console.error('ImageGen Error:', e.message);
      return sendMessage(senderId, { text: '❎ | Failed to generate image.' }, pageAccessToken);
    }
  }
};