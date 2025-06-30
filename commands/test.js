const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ytsr = require('@distube/ytsr');

const TMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

module.exports = {
  name: 'mp3',
  description: 'Search YouTube and send the MP3 audio file directly.',
  usage: '-mp3 <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Please provide a song title.' }
      });
    }

    // Step 1: YouTube Search
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
    const sig = encodeURIComponent(`SH+xhD5yQIvpe7Cc4AKrZCw9sCIl/vyS3bL3/NH0vrfxLczcocuvk/u0eeMewFnOkDDtd5yAYEu0te6FhDbK9LLeVz+N3nUDo66w4BoJQyEcRxvM/HE1gJHugtXQEjxXvEfzqIywalpHPaF5pSG0kQpRcRBlyNTeaYGBO12Jj6s2Dc/QRTw7BRACorI1rHJjo0yXYLbDWNCpluj2SKLead0SWQVKWx9Tivv5yZ2fat/ZYG8hJSuVP+Xi7Zs/IevQGSaXY4rzZ7sY9pcvdO2qG9zhh1ySzFDDKsePQmiyUidwrnH5PFPs5frpSiZYr7tolA6ckU6fsGoMKpHpiV0mCg==`);
    const convertUrl = `https://uumm.mnuu.nu/api/v1/convert?sig=${sig}`;

    let downloadURL, title;

    try {
      // Step 2: Get convertURL response
      const { data: convertRes } = await axios.get(convertUrl, {
        headers: {
          Host: 'uumm.mnuu.nu',
          Origin: 'https://y2mate.nu',
          Referer: 'https://y2mate.nu/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          Accept: '*/*'
        }
      });

      const nextUrl = convertRes.convertURL;
      if (!nextUrl) throw new Error('No convertURL');

      // Step 3: Follow redirectURL if needed
      const { data: redirectRes } = await axios.get(nextUrl, {
        headers: {
          Host: new URL(nextUrl).host,
          Origin: 'https://y2mate.nu',
          Referer: 'https://y2mate.nu/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          Accept: '*/*'
        }
      });

      const followUrl = redirectRes.redirect === 1 ? redirectRes.redirectURL : nextUrl;

      // Step 4: Final fetch to get downloadURL
      const { data: final } = await axios.get(followUrl, {
        headers: {
          Host: new URL(followUrl).host,
          Origin: 'https://y2mate.nu',
          Referer: 'https://y2mate.nu/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          Accept: '*/*'
        }
      });

      if (!final.downloadURL) {
        return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
          recipient: { id },
          message: { text: '❌ No MP3 download link found.' }
        });
      }

      downloadURL = final.downloadURL;
      title = final.title || 'Audio';

    } catch (err) {
      console.error('[Redirect/Download URL Error]', err.message);
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to resolve MP3 download.' }
      });
    }

    // Step 5: Download MP3
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

      // Step 6: Send MP3 via Graph API v23.0
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