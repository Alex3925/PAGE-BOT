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
  description: 'Searches YouTube, fetches MP3 from y2mate.nu, and sends it as Messenger audio.',
  usage: '-mp3 <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) {
      return sendMessage(id, { text: '❌ Please provide a song title.' }, token);
    }

    // Step 1: Search YouTube
    const result = (await ytsr(args.join(' ') + ' official music video', { limit: 1 })).items[0];
    if (!result) return sendMessage(id, { text: '❌ No YouTube result found.' }, token);

    const videoId = new URL(result.url).searchParams.get('v');
    const sig = encodeURIComponent(`Jw8fCoukC80p1auFdBskok1WZG+vNMWmszSBuBdSIWc7ci+XHknlEvFCIrhV3/ofSpP7+nrduQC2R91PYRAgKsGYqra5h04l1wXDZ+UZOTvjlDbPHzWVphwChSU8/jk5Gf9WYa/bwk8kKPiKEAIY3dZ2emOn0Thi2IsJHKMoRYnsM5UFHgi49rBqTLGdyM/8hGE3Cej/y81syKtfwhX13fHN/gumbEcOvP8PqiqlG6zHDXgI1YDy84+K07cL1bMW5AsBxa+BwGQsNZ2YjTXVer7VavzEouakM9wJlR2OOCmPxl+wbKUoDpDbqg/P3/TQLerKBOTg38rlkKiP7eULOQ==`);
    const apiURL = `https://nmuu.mnuu.nu/api/v1/convert?sig=${sig}&v=${videoId}&f=mp3&_=${Math.random()}`;

    let downloadURL;
    try {
      const { data } = await axios.get(apiURL, {
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
        return sendMessage(id, { text: '⚠️ Failed to get MP3 download URL.' }, token);
      }

      downloadURL = data.downloadURL;

    } catch (err) {
      console.error('[y2mate.nu error]', err.message);
      return sendMessage(id, { text: '❌ Failed to fetch MP3 info.' }, token);
    }

    const filename = `${id}_${Date.now()}.mp3`;
    const filePath = path.join(TMP_DIR, filename);

    try {
      // Step 2: Download MP3
      const res = await axios({ url: downloadURL, method: 'GET', responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Step 3: Upload MP3 to Facebook
      const form = new FormData();
      form.append('message', JSON.stringify({ attachment: { type: 'audio', payload: {} } }));
      form.append('filedata', fs.createReadStream(filePath));

      const uploadRes = await axios.post(
        `https://graph.facebook.com/v17.0/me/message_attachments?access_token=${token}`,
        form,
        { headers: form.getHeaders() }
      );

      const attachmentId = uploadRes.data.attachment_id;

      // Step 4: Send MP3 as audio attachment
      await sendMessage(id, {
        message: {
          attachment: {
            type: 'audio',
            payload: { attachment_id: attachmentId }
          }
        }
      }, token);

    } catch (err) {
      console.error('[MP3 send error]', err.message);
      sendMessage(id, { text: '❌ Failed to send MP3 file.' }, token);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};