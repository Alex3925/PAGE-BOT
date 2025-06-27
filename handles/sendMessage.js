const axios = require('axios');
const path = require('path');

// Helper function for POST requests
const axiosPost = (url, data, params = {}) => axios.post(url, data, { params }).then(res => res.data);

// Send a message with typing indicators
const sendMessage = async (senderId, { text = '', attachment = null }, pageAccessToken) => {
  if (!text && !attachment) return;

  const url = `https://graph.facebook.com/v23.0/me/messages`;
  const params = { access_token: pageAccessToken };

  try {
    // Turn on typing indicator
    await axiosPost(url, { recipient: { id: senderId }, sender_action: "typing_on" }, params);

    // Prepare message payload based on content
    const messagePayload = {
      recipient: { id: senderId },
      message: {}
    };

    if (text) {
      messagePayload.message.text = text;
    }

    if (attachment) {
      if (attachment.type === 'template') {
        // Use payload directly for template type
        messagePayload.message.attachment = {
          type: 'template',
          payload: attachment.payload
        };
      } else {
        // For other types (audio, image, etc.)
        messagePayload.message.attachment = {
          type: attachment.type,
          payload: {
            url: attachment.payload.url,
            is_reusable: true
          }
        };
      }
    }

    // Send the message
    await axiosPost(url, messagePayload, params);

    // Turn off typing indicator
    await axiosPost(url, { recipient: { id: senderId }, sender_action: "typing_off" }, params);

  } catch (e) {
    const errorMessage = e.response?.data?.error?.message || e.message;
    console.error(`Error in ${path.basename(__filename)}: ${errorMessage}`);
  }
};

module.exports = { sendMessage };