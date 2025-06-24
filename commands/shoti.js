const axios = require('axios');

module.exports = {
  name: 'shoti',
  description: 'Get a Shoti video',
  author: 'Alex',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const apiKey = '$shoti-53a18a1cf56001d7da6ad8b036488d3c070385b5';
    const apiUrl = 'https://shotis.vercel.app/api/request/f';

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      const shotiUrl = response.data.url;
      const kupal = {
        text: `𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${response.data.username}\n𝗡𝗶𝗰𝗸𝗻𝗮𝗺𝗲: ${response.data.nickname}\n𝗥𝗲𝗴𝗶𝗼𝗻: N/A\n\n𝖲𝖾𝗇𝖽𝗂𝗇𝗴 𝗏𝗂𝖽𝖾𝗈, 𝗐𝖺𝗂𝗍 𝖺 𝗌𝖾𝖼𝗈𝗇𝖽...`,
      };

      if (shotiUrl) {
        sendMessage(senderId, kupal, pageAccessToken);
        sendMessage(senderId, {
          attachment: {
            type: 'video',
            payload: {
              url: shotiUrl,
              is_reusable: true
            }
          },
          quick_replies: [
            {
              content_type: "text",
              title: "More shoti",
              payload: "MORE SHOTI"
            },
            {
              content_type: "text",
              title: "Help",
              payload: "HELP"
            },
            {
              content_type: "text",
              title: "Privacy Policy",
              payload: "PRIVACY POLICY"
            },
            {
              content_type: "text",
              title: "Feedback",
              payload: "FEEDBACK"
            }
          ]
        }, pageAccessToken);
      } else {
        sendMessage(senderId, {
          attachment: {
            type: 'video',
            payload: {
              url: "https://i.imgur.com/1bPqMvK.mp4",
              is_reusable: true
            }
          }
        }, pageAccessToken);
      }
    } catch (error) {
      sendMessage(senderId, { text: 'Sorry, there was an error processing your request.' }, pageAccessToken);
    }
  }
};
