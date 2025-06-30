const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ytsr = require('@distube/ytsr');
const { sendMessage } = require('../handles/sendMessage');

const TMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

module.exports = {
  name: 'mp3',
  description: 'Searches YouTube or uses link to download MP3 and sends it via Messenger.',
  usage: '-mp3 <search keywords or YouTube link>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) {
      return sendMessage(id, { text: '❌ Please provide a song title or YouTube link.' }, token);
    }

    let videoId = null;
    const query = args.join(' ');

    // Step 1: Determine if input is a YouTube link
    try {
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const url = new URL(query.startsWith('http') ? query : `https://${query}`);
        videoId = url.searchParams.get('v') || url.pathname.split('/').pop();
      } else {
        const search = await ytsr(query + ' official music video', { limit: 1 });
        const result = search.items[0];
        if (!result?.url) return sendMessage(id, { text: '❌ No YouTube result found.' }, token);
        videoId = new URL(result.url).searchParams.get('v');
      }
    } catch (e) {
      console.error('[YouTube Parsing/Search Error]', e.message);
      return sendMessage(id, { text: '❌ Invalid link or search failed.' }, token);
    }

    // Step 2: Build API call to y2mate-style server
    const sig = encodeURIComponent(
      'Wd2FTxj88xrSUNva+qfqVIe8J7L4sNg30aMMbmvnjq9Xi6KijSujCc8TTAExPOowBvNQMBvQ8Rx9dQ40XKmPJa1PPglBliWVKE7Y3ZbBkPxoi8TiQsKGsj21XUTQY/vQX1FxxqKr+n9SiiotTU2mUEiAW6kE6Ub6OGWGaDp8mi8n8MKo4UCAf5iA+jOf1r0KZZ2T1OUDdUSIi3DhN3L7ALOqqjj3I32ALY7SOoHNanOr8Y3lqZ0MpogWNZhthqFDn+I06dcsL0MpkoaSi0L/h8gasMAv7YYnrGcgjfWGxQY0D0gr8eIJHLZpX2zhiK0UZBiXRIhmCcndD/3uaLVhsw=='
    );
    const apiUrl = `https://nmuu.mnuu.nu/api/v1/convert?sig=${sig}&v=${videoId}&f=mp3&_=${Math.random()}`;

    let downloadURL, title;

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
        return sendMessage(id, { text: '❌ MP3 download link not found.' }, token);
      }

      downloadURL = data.downloadURL;
      title = data.title || 'Audio';

    } catch (err) {
      console.error('[API Fetch Error]', err.message);
      return sendMessage(id, { text: '⚠️ Failed to get MP3 download info.' }, token);
    }

    const filename = `${id}_${Date.now()}.mp3`;
    const filePath = path.join(TMP_DIR, filename);

    try {
      // Download MP3
      const res = await axios({ url: downloadURL, method: 'GET', responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Upload to Facebook
      const form = new FormData();
      form.append('message', JSON.stringify({ attachment: { type: 'audio', payload: {} } }));
      form.append('filedata', fs.createReadStream(filePath));

      const uploadRes = await axios.post(
        `https://graph.facebook.com/v17.0/me/message_attachments?access_token=${token}`,
        form,
        { headers: form.getHeaders() }
      );

      const attachmentId = uploadRes.data.attachment_id;

      // Send MP3 to user
      await sendMessage(id, {
        message: {
          attachment: {
            type: 'audio',
            payload: { attachment_id: attachmentId }
          }
        }
      }, token);

    } catch (err) {
      console.error('[Download/Upload Error]', err.message);
      sendMessage(id, { text: '❌ Error downloading or sending MP3.' }, token);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};