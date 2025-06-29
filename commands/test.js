const axios = require('axios');

const getImageUrl = async (event, token, cache) => {
  const mid = event?.message?.reply_to?.mid || event?.message?.mid;
  if (mid) {
    try {
      const res = await axios.get(`https://graph.facebook.com/v23.0/${mid}/attachments`, {
        params: { access_token: token }
      });
      return res.data?.data?.[0]?.image_data?.url ?? res.data?.data?.[0]?.file_url;
    } catch (e) {
      console.warn("Image fetch error:", e?.response?.data || e.message);
    }
  }
  const c = cache?.get(event.sender.id);
  return c && Date.now() - c.timestamp < 3e5 ? c.url : null;
};

module.exports = {
  name: 'url',
  description: 'Get image URL from reply or cache',
  usage: '-getimage',
  author: 'coffee',

  async execute(id, _, token, event, send, cache) {
    const url = await getImageUrl(event, token, cache);
    send(id, { text: url ? `✅ | Image URL:\n${url}` : '❎ | No image found. Reply to or send one first.' }, token);
  }
};