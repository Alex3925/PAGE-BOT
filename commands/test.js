const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ytsr = require('@distube/ytsr');

const TMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

module.exports = {
  name: 'mp3',
  description: 'Searches YouTube and sends the MP3 audio file directly.',
  usage: '-mp3 <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Please provide a song title.' }
      });
    }

    // Step 1: Search YouTube
    let result;
    try {
      result = (await ytsr(args.join(' ') + ' official music video', { limit: 1 })).items[0];
    } catch (err) {
      console.error('[YTSR Error]', err.message);
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to search YouTube.' }
      });
    }

    if (!result || !result.url) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ No YouTube result found.' }
      });
    }

    const videoId = new URL(result.url).searchParams.get('v');
    const sig = encodeURIComponent(`Wd2FTxj88xrSUNva+qfqVIe8J7L4sNg30aMMbmvnjq9Xi6KijSujCc8TTAExPOowBvNQMBvQ8Rx9dQ40XKmPJa1PPglBliWVKE7Y3ZbBkPxoi8TiQsKGsj21XUTQY/vQX1FxxqKr+n9SiiotTU2mUEiAW6kE6Ub6OGWGaDp8mi8n8MKo4UCAf5iA+jOf1r0KZZ2T1OUDdUSIi3DhN3L7ALOqqjj3I32ALY7SOoHNanOr8Y3lqZ0MpogWNZhthqFDn+I06dcsL0MpkoaSi0L/h8gasMAv7YYnrGcgjfWGxQY0D0gr8eIJHLZpX2zhiK0UZBiXRIhmCcndD/3uaLVhsw==`);
    const apiUrl = `https://nmuu.mnuu.nu/api/v1/convert?sig=${sig}&v=${videoId}&f=mp3&_=${Math.random()}`;

    let downloadURL, title;

    // Step 2: Fetch MP3 Info
    try {
      const { data } = await axios.get(apiUrl, {
        headers: {
          Host: 'nmuu.mnuu.nu',
          Connection: 'keep-alive',
          'sec-ch-ua-platform': '"Android"',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
          'sec-ch-ua-mobile': '?1',
          Accept: '*/*',
          'Sec-GPC': '1',
          'Accept-Language': 'en-US,en;q=0.7',
          Origin: 'https://y2mate.nu',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          Referer: 'https://y2mate.nu/',
          'Accept-Encoding': 'gzip, deflate, br, zstd'
        }
      });

      if (!data?.downloadURL) {
        return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
          recipient: { id },
          message: { text: '❌ MP3 download link not found.' }
        });
      }

      downloadURL = data.downloadURL;
      title = data.title || 'Audio';

    } catch (err) {
      console.error('[MP3 API Error]', err.message);
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to fetch MP3 data.' }
      });
    }

    // Step 3: Download MP3
    const filename = `${id}_${Date.now()}.mp3`;
    const filePath = path.join(TMP_DIR, filename);

    try {
      const res = await axios({ url: downloadURL, method: 'GET', responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Step 4: Send MP3 as audio file
      const form = new FormData();
      form.append('recipient', JSON.stringify({ id }));
      form.append('message', JSON.stringify({
        attachment: {
          type: 'audio',
          payload: {}
        }
      }));
      form.append('filedata', fs.createReadStream(filePath));

      await axios.post(
        `https://graph.facebook.com/v23.0/me/messages?access_token=${token}`,
        form,
        { headers: form.getHeaders() }
      );

    } catch (err) {
      console.error('[Download/Send Error]', err.message);
      await axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to send MP3 file.' }
      });
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};