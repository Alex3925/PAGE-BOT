const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

const apiKeys = [
  "h3GKJs26qdaD2ba2aKBYiuFt",
  "8GZdyztrAm7ygzde2EAcPNNg",
  "s1NPvP5zJpaL1msj7TCDhFmS",
  "fm7tXaPLSCyKApyBaCNPc99Z",
  "pEvqRAZLuBR1Wqqv66Rrqzwk",
  "84utdcBzF6Pbi8MVMZbdFSjW"
];

const getImageUrl = async (event, token) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (!mid) return null;

  try {
    const { data } = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
      params: { access_token: token }
    });

    const imageUrl = data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
    return imageUrl;
  } catch (err) {
    console.error("Image URL fetch error:", err?.response?.data || err.message);
    return null;
  }
};

module.exports = {
  name: 'removebg',
  description: 'Remove image background using Remove.bg API.',
  usage: '-removebg (reply to an image or use last sent image)',
  author: 'coffee',

  execute: async (senderId, args, pageAccessToken, event, sendMessage, imageCache) => {
    // First try reply_to mid (normal behavior)
    let imageUrl = await getImageUrl(event, pageAccessToken);

    // If no reply image found, fallback to cached image
    if (!imageUrl && imageCache) {
      const cachedImage = imageCache.get(senderId);
      if (cachedImage && Date.now() - cachedImage.timestamp <= 5 * 60 * 1000) { // 5 min expiry
        imageUrl = cachedImage.url;
        console.log(`Using cached image for sender ${senderId}: ${imageUrl}`);
      }
    }

    if (!imageUrl) {
      return sendMessage(senderId, { text: '❎ | Please reply to an image or send one first, then run this command.' }, pageAccessToken);
    }

    const tmpInput = path.join(__dirname, `tmp_input_${Date.now()}.jpg`);
    const tmpOutput = path.join(__dirname, `tmp_output_${Date.now()}.png`);
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    try {
      // Download original image
      const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(tmpInput, imgResponse.data);

      // Call Remove.bg
      const form = new FormData();
      form.append('size', 'auto');
      form.append('image_file', fs.createReadStream(tmpInput));

      const rbgRes = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'X-Api-Key': apiKey
          },
          responseType: 'arraybuffer'
        }
      );

      fs.writeFileSync(tmpOutput, rbgRes.data);

      // Upload result to Facebook
      const fbForm = new FormData();
      fbForm.append('message', JSON.stringify({
        attachment: {
          type: 'image',
          payload: { is_reusable: true }
        }
      }));
      fbForm.append('filedata', fs.createReadStream(tmpOutput));

      const uploadRes = await axios.post(
        `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
        fbForm,
        { headers: fbForm.getHeaders() }
      );

      const attachmentId = uploadRes.data.attachment_id;

      await axios.post(
        `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
        {
          recipient: { id: senderId },
          message: {
            attachment: {
              type: 'image',
              payload: {
                attachment_id: attachmentId
              }
            }
          }
        }
      );

    } catch (err) {
      console.error('RemoveBG Error:', err.response?.data || err.message || err);
      return sendMessage(senderId, { text: '❎ | Failed to remove background. Please try again later.' }, pageAccessToken);
    } finally {
      try { if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput); } catch {}
      try { if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput); } catch {}
    }
  }
};