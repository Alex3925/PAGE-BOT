const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs/promises');
const path = require('path');
const { createReadStream } = require('fs');

const getImageUrl = async (event, token, cache, senderId) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  try {
    if (mid) {
      const { data } = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
        params: { access_token: token }
      });
      return data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url;
    }
  } catch (e) {
    console.error("FB image fetch error:", e?.response?.data || e.message);
  }
  const cached = cache?.get(senderId);
  return (cached && Date.now() - cached.timestamp < 5 * 60_000) ? cached.url : null;
};

module.exports = {
  name: 'preview',
  description: 'Fetch and preview the last or replied image.',
  usage: '-getimage',
  author: 'coffee',

  async execute(senderId, args, token, event, sendMessage, imageCache) {
    const imageUrl = await getImageUrl(event, token, imageCache, senderId);
    if (!imageUrl) return sendMessage(senderId, { text: '❎ | No image found. Reply to or send one first.' }, token);

    const tmpPath = path.join(__dirname, `tmp_${Date.now()}.jpg`);
    try {
      const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      await fs.writeFile(tmpPath, data);

      const form = new FormData();
      form.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
      form.append('filedata', createReadStream(tmpPath));

      const { data: upload } = await axios.post(
        `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${token}`,
        form, { headers: form.getHeaders() }
      );

      await axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id: senderId },
        message: { attachment: { type: 'image', payload: { attachment_id: upload.attachment_id } } }
      });
    } catch (err) {
      console.error('Image send error:', err?.response?.data || err.message);
      sendMessage(senderId, { text: '❎ | Failed to send the image preview.' }, token);
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }
};