const axios = require('axios');
const ytsr = require('@distube/ytsr');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'Searches for songs on YouTube and provides audio links.',
  usage: '-test <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: '❌ Please provide a song title.' }, token);

    const query = `${args.join(' ')}, official music video`;
    const result = (await ytsr(query, { limit: 1 })).items[0];
    if (!result?.url || !result?.id) return sendMessage(id, { text: '❌ Could not find song.' }, token);

    const videoUrl = result.url;

    try {
      // Step 1: Get available MP3 tasks (returns a list with hash)
      const { data: taskOptions } = await axios.post(
        'https://savemp3.net/b772a/youtube-video-to-mp3/',
        [videoUrl],
        {
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
            origin: 'https://savemp3.net',
            referer: 'https://savemp3.net/b772a/youtube-video-to-mp3/',
            'user-agent': 'Mozilla/5.0',
          },
        }
      );

      const taskData = taskOptions?.[1]?.data;
      const task = taskData?.tasks?.find(t => t.bitrate === 128) || taskData?.tasks?.[0];
      if (!task?.hash) return sendMessage(id, { text: '❌ Could not retrieve MP3 hash.' }, token);

      // Step 2: Create conversion task
      const { data: convertInit } = await axios.post(
        'https://savemp3.net/b772a/youtube-video-to-mp3/',
        [
          {
            task: {
              bitrate: task.bitrate,
              filesize: task.filesize,
              hash: task.hash,
            },
            length: taskData.durationSec || 180,
            from: null,
            to: null,
          },
        ],
        {
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
            origin: 'https://savemp3.net',
            referer: 'https://savemp3.net/b772a/youtube-video-to-mp3/',
            'user-agent': 'Mozilla/5.0',
          },
        }
      );

      const taskId = convertInit?.[1]?.data?.taskId;
      if (!taskId) return sendMessage(id, { text: '❌ Failed to start conversion.' }, token);

      // Step 3: Poll for download link
      let downloadUrl = null;
      for (let i = 0; i < 10; i++) {
        const { data: pollData } = await axios.post(
          'https://savemp3.net/b772a/youtube-video-to-mp3/',
          [taskId],
          {
            headers: {
              'content-type': 'text/plain;charset=UTF-8',
              origin: 'https://savemp3.net',
              referer: 'https://savemp3.net/b772a/youtube-video-to-mp3/',
              'user-agent': 'Mozilla/5.0',
            },
          }
        );

        const poll = pollData?.[1]?.data;
        if (poll?.status === 'finished' && poll.download) {
          downloadUrl = poll.download;
          break;
        }

        await new Promise(res => setTimeout(res, 1500)); // wait 1.5s
      }

      if (!downloadUrl) return sendMessage(id, { text: '❌ MP3 is not ready after several tries.' }, token);

      // Step 4: Send preview card
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: `🎵 ${result.title}`,
                image_url: result.bestThumbnail?.url || '',
                subtitle: 'Tap below to play audio.',
              },
            ],
          },
        },
      }, token);

      // Step 5: Send actual MP3
      sendMessage(id, {
        attachment: {
          type: 'audio',
          payload: {
            url: downloadUrl,
          },
        },
      }, token);

    } catch (err) {
      console.error('❌ Error downloading MP3:', err);
      return sendMessage(id, { text: '❌ Something went wrong. Please try again later.' }, token);
    }
  },
};