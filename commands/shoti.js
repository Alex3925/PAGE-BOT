const axios = require('axios');
‎
‎module.exports = {
‎  name: 'shoti',
‎  description: 'Get a Shoti video',
‎  author: 'Cliff & John liby',
‎  async execute(senderId, args, pageAccessToken, sendMessage) {
‎    const apiKey = 'shipazu';
‎    const apiUrl = `https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=${apiKey}`;
‎
‎    try {
‎      const response = await axios.get(apiUrl);
‎      const shotiUrl = response.data.shotiurl;
‎      const kupal = {
‎        text: `𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${response.data.username}\n𝗡𝗶𝗰𝗸𝗻𝗮𝗺𝗲: ${response.data.nickname}\n𝗥𝗲𝗴𝗶𝗼𝗻: ${response.data.region}\n\n𝖲𝖾𝗇𝖽𝗂𝗇𝗀 𝗏𝗂𝖽𝖾𝗈, 𝗐𝖺𝗂𝗍 𝖺 𝗌𝖾𝖼𝗈𝗇𝖽...`,
‎      };
‎
‎      if (shotiUrl) {
‎        sendMessage(senderId, kupal, pageAccessToken);
‎        sendMessage(senderId, {
‎          attachment: {
‎            type: 'video',
‎            payload: {
‎              url: shotiUrl,
‎              is_reusable: true
‎            }
‎          },
‎          quick_replies: [
‎            {
‎              content_type: "text",
‎              title: "More shoti",
‎              payload: "MORE SHOTI"
‎            },
‎            {
‎              content_type: "text",
‎              title: "Help",
‎              payload: "HELP"
‎            },
‎            {
‎              content_type: "text",
‎              title: "Privacy Policy",
‎              payload: "PRIVACY POLICY"
‎            },
‎            {
‎              content_type: "text",
‎              title: "Feedback",
‎              payload: "FEEDBACK"
‎            }
‎          ]
‎        }, pageAccessToken);
‎      } else {
‎        sendMessage(senderId, {
‎          attachment: {
‎            type: 'video',
‎            payload: {
‎              url: "https://i.imgur.com/1bPqMvK.mp4",
‎              is_reusable: true
‎            }
‎          }
‎        }, pageAccessToken);
‎      }
‎    } catch (error) {
‎      sendMessage(senderId, { text: 'Sorry, there was an error processing your request.' }, pageAccessToken);
‎    }
‎  }
‎};
