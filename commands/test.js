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

    // 1. Search YouTube
    const result = (await ytsr(`${args.join(' ')} official music video`, { limit: 1 })).items[0];
    if (!result?.url || !result?.id) return sendMessage(id, { text: '❌ Could not find song.' }, token);

    try {
      // 2. Step 1: Get hash from savemp3.net
      const extract = await axios.post(
        'https://savemp3.net/b772a/youtube-video-to-mp3/',
        [
          result.url,
          '0.166pbFrllhNyPDajscf-12kXLYExYP2GT3IlozDFK8uR9qB1-oIfutyCFEPIRhIsf-9iJtZVxuekNDPSETMG4hNgjYACUQUS459PxuNjTibxXZb9coMXXoY39F12Wxu3jk4LFHpk6i86RjgqrGOqDo-jeJ33WgDP3QENARTvSN21ftDrPxmd01OtmXTiszqtOFfUdsvMS8MRgTDzSIL0AalZWC5IjW87yWB2efA33cLiUN-hnaJAksvbNbQZQAx9PmnFc8YNxHpa1CkT2s7mV22V36u5xDgwrwDiyHOPrTUv6Z4UoczO3iHj7mv-EFItRfUC-TWoHdCgqN5xvRNogATRMezK1xH_dFuQa9KjSwALzemfqaos4yzQ6PAVRTbO1L6IUPZpGrzifBMAwlFlKxKUGKyLwa-gCNgWgY8MjCOyoIJrvU3H8--H7oId7WHwg1BrirMwKKM5zBy19jDwu0B3yClGGb6QrmM0RkoHuAqz1YiQUAinJuSGLdFXcwDVSJDdY4l7__Qd-vo8pW9ldjSucvGjD8tvlY-RMiZUlyss2GuZNpFrSUbLpSMUjc5zwLiusLxBXCdlw2A6aM0ofwfWoGhGWW7BvMW69gpdUbtwGN7cFFPh_pyP2XXFC_jBSABTipkAG3As8Ad4T1_KA0KGaUTLabvGNssflTw40DokcQR8-IUa3BK9FHHUDn8-s1rRXZ2brG9tNAKPuVWmG1hXP8oLKbDZcJ9g2xKoEsbM51xV6ZTJ_4OBC9_9Hk7bKItZCrNb17HSML3PSBI2-g0ex9KMLwk0ma-ZFSD5__fV7-1T5qfT8Xjomm4CZqEKTqB8uKCWIVpJt4prYQQaMjf48f-zit-zeIVX8o44ItFw_mjPsjJ5AZqcfafuxCr3.j8kwXGKCmBckC2g_xziwYw.259c3a89d62e9d14b6268bb37f3e173dcccfe508e6cae9175615b679c3b7c4b4'
        ],
        {
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
            'referer': 'https://savemp3.net/b772a/youtube-video-to-mp3/',
            'origin': 'https://savemp3.net',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          }
        }
      );

      const title = extract.data[1]?.data?.title || result.title;
      const thumbnail = 'https:' + (extract.data[1]?.data?.thumbnailUrl || result.thumbnail);
      const tasks = extract?.data?.[1]?.data?.tasks;
      if (!tasks || !Array.isArray(tasks)) return sendMessage(id, { text: '❌ No audio tasks found.' }, token);

      const best = tasks.find(t => t.bitrate === 320) || tasks.at(-1);
      const hash = best?.hash;
      if (!hash) return sendMessage(id, { text: '❌ Could not retrieve MP3 hash.' }, token);

      // 3. Step 2: Trigger conversion and wait for completion
      const convertRes = await axios.post(
        'https://savemp3.net/api/status',
        { hash },
        {
          headers: {
            'accept': 'application/json',
            'origin': 'https://savemp3.net',
            'referer': 'https://savemp3.net/',
            'user-agent': 'Mozilla/5.0',
            'content-type': 'application/json'
          }
        }
      );

      const finalUrl = convertRes.data?.url;
      if (!finalUrl) return sendMessage(id, { text: '❌ Conversion failed. Try again later.' }, token);

      // 4. Send info card
      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎵 ${title}`,
              image_url: thumbnail,
              subtitle: 'MP3 ready. Tap below to listen or download.'
            }]
          }
        }
      }, token);

      // 5. Send audio file
      sendMessage(id, {
        attachment: {
          type: 'audio',
          payload: { url: finalUrl }
        }
      }, token);

    } catch (err) {
      console.error('❌ Error:', err?.message || err);
      return sendMessage(id, { text: '❌ Something went wrong while fetching the MP3.' }, token);
    }
  }
};