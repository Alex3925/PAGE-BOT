const axios = require('axios');
const path = require('path');

// Helper function for POST requests
const axiosPost = (url, data, params = {}) =>
  axios.post(url, data, { params }).then(res => res.data);

// Send a message with typing indicators
const sendMessage = async (senderId, { text = '', attachment = null }, pageAccessToken) => {
  if (!text && !attachment) return;

  const url = `https://graph.facebook.com/v23.0/me/messages`;
  const params = { access_token: pageAccessToken };

  try {
    // Turn on typing indicator
    await axiosPost(url, { recipient: { id: senderId }, sender_action: 'typing_on' }, params);

    // Build message payload
    const messagePayload = {
      recipient: { id: senderId },
      message: {}
    };

    if (text) {
      messagePayload.message.text = text;
    }

    if (attachment) {
      if (attachment.type === 'template') {
        messagePayload.message.attachment = {
          type: 'template',
          payload: attachment.payload
        };
      } else {
        messagePayload.message.attachment = {
          type: attachment.type,
          payload: {
            url: attachment.payload.url,
            is_reusable: true
          }
        };
      }
    }

    // Log outgoing message for debug
    console.log('📤 Sending payload:', JSON.stringify(messagePayload, null, 2));

    // Send the message
    const response = await axiosPost(url, messagePayload, params);
    console.log('✅ Message sent:', response);

    // Turn off typing indicator
    await axiosPost(url, { recipient: { id: senderId }, sender_action: 'typing_off' }, params);

  } catch (e) {
    console.error(`❌ Error in ${path.basename(__filename)}:`);

    const errorMessage =
      e?.response?.data?.error?.message ||
      e?.response?.data ||
      e?.message ||
      JSON.stringify(e);

    console.error('📛 Message:', errorMessage);

    if (e?.response?.data) {
      console.error('🔍 Full response data:', JSON.stringify(e.response.data, null, 2));
    }
    if (e?.config) {
      console.error('🧾 Axios config:', {
        url: e.config.url,
        method: e.config.method,
        headers: e.config.headers,
        data: e.config.data
      });
    }
  }
};

module.exports = { sendMessage };