const axios = require('axios');
const ytsr = require('@distube/ytsr');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches for songs on YouTube and provides audio links.',
  usage: '-test <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: 'Error: Please provide a song title.' }, token);

    const query = `${args.join(' ')}, official music video`;
    const result = (await ytsr(query, { limit: 1 })).items[0];
    if (!result?.url || !result?.id) return sendMessage(id, { text: 'Error: Could not find song.' }, token);

    const videoId = result.id;

    try {
      // Step 1: Initial request to get task info and hash
      const initConvert = await axios.post('https://savemp3.net/b772a/youtube-video-to-mp3/', [
        `https://youtu.be/${videoId}`,
        '0.1Q1GHkL20jC5UuiFVgpX34tX-M3CuBOXVmAqkV6rxW31fR89AleMWxvdpfRUtzCOHjUHZBch_kiKnLmomNCzeo_ovXBTZNLxhkR8JJuEwq00hgHithDW7gpBfJqSThWDqhOFi8C2bOg0c62y-3DgZ_ynyxjida1K9QwMqq5Gbw9QAkjxP7j-8XAKruiXFxLHieGpSqvb6iuBzdLvq9h9CBznmMPOkA5gJ_9OI4N2KB7iaGAlIBoIqcC4IRBWWM2bnhDMmHDtVqQTMUjdvHdNb5ZFisQcylHGZhE5iyRpO3Ra-c77oyj7-TXQGBmswMnoXE-qy4rAzrP2LPfD6oOZLBmDraMn0wZ8bmwbPEFjM4J14bjbOlsUKDzjz6OnKsch4ZOmDQuOCO9Gu1I9aFwv2S6mGWAmvF3kF-YreY3tyIKJCmUT8-exEaCQkBnZK92Q28aTI-KJlEXxjpT8YnQvuVIZxmttm_Q_t8gc3FMUG4U_c35UUg6Np8Zl_q-mDwDVC4wTqDZQ9hTjaXJOSiIBREFKhucyX1zU2PtzSHyaQEAJk5EpZbMDQLT3ZLIdYMXWiyG-qMThCo3-4T2DAY4Ba1tQcXcycRpVejvVTWAXanAFrMiLwEobwDB4ZXE2NaoxKdOQM3TpWfI7YsV4emBlrjRWahzlwD1tBe-iSPRa5A_NbYenC22Oy-reCKhMngX0KGnQ-IXrMZej0lujSQrXOFIvpe_Pqz7xu3SXdJY_uufNh4-uN93P1G-Ax2xFVr1ZiuYMuaXXOkNB0fbb4WEBekGvjJHXixtNo3vUBF4UMnsS3nTS2dNCpH5lxnjj4IspERwm8uvZCdDokoPlVWQ3Sx4_zH8sd7jOB6cbzY8OEoaP46qS5EEwub6TL7hxvhQI.bc05yik5KuHgXy4fu7xWQw.ce1a9180a72ceb6c069544e9f380e30a6426e90956fc3dbcb7a4c266be5eccdc`
      ], {
        headers: {
          'content-type': 'text/plain;charset=UTF-8',
          'origin': 'https://savemp3.net',
          'referer': 'https://savemp3.net/b772a/youtube-video-to-mp3/',
          'user-agent': 'Mozilla/5.0'
        }
      });

      const audioTask = initConvert.data?.[1]?.data?.tasks?.find(x => x.bitrate === 128) || initConvert.data?.[1]?.data?.tasks?.[0];
      if (!audioTask?.hash) return sendMessage(id, { text: 'Error: No MP3 hash found.' }, token);

      // Step 2: Request MP3 task using hash
      const taskCreate = await axios.post('https://savemp3.net/b772a/youtube-video-to-mp3/', [{
        task: {
          bitrate: audioTask.bitrate,
          filesize: audioTask.filesize,
          hash: audioTask.hash
        },
        length: initConvert.data[1].data.durationSec
      }], {
        headers: {
          'content-type': 'text/plain;charset=UTF-8',
          'origin': 'https://savemp3.net',
          'referer': 'https://savemp3.net/b772a/youtube-video-to-mp3/',
          'user-agent': 'Mozilla/5.0'
        }
      });

      const taskId = taskCreate.data?.[1]?.data?.taskId;
      if (!taskId) return sendMessage(id, { text: 'Error: Failed to create MP3 task.' }, token);

      // Step 3: Poll for download URL
      let downloadUrl = null;
      for (let i = 0; i < 10; i++) {
        const status = await axios.post('https://savemp3.net/b772a/youtube-video-to-mp3/', [taskId], {
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
            'origin': 'https://savemp3.net',
            'referer': 'https://savemp3.net/b772a/youtube-video-to-mp3/',
            'user-agent': 'Mozilla/5.0'
          }
        });

        const data = status.data?.[1]?.data;
        if (data?.status === 'finished') {
          downloadUrl = data.download;
          break;
        }

        await new Promise(r => setTimeout(r, 1500)); // wait 1.5s
      }

      if (!downloadUrl) return sendMessage(id, { text: 'Error: MP3 download not ready.' }, token);

      // Step 4: Send info card
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎧 Title: ${result.title}`,
              image_url: result.bestThumbnail?.url || '',
              subtitle: 'Audio ready. Tap below to listen.'
            }]
          }
        }
      }, token);

      // Step 5: Send final MP3
      sendMessage(id, {
        attachment: {
          type: 'audio',
          payload: { url: downloadUrl }
        }
      }, token);

    } catch (err) {
      console.error('Error:', err.message);
      return sendMessage(id, { text: '❌ Error: MP3 download failed.' }, token);
    }
  }
};