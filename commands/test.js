const axios = require('axios');
const ytsr = require('@distube/ytsr');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const TMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const BASE_INIT_URL = 'https://d.mnuu.nu/api/v1/init';

module.exports = {
  name: 'mp3',
  description: 'Search YouTube and send audio as MP3 via Messenger.',
  usage: '-mp3 <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args.length) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Please provide a song title.' }
      });
    }

    // Step 1: Search YouTube
    const query = args.join(' ') + ' official music video';
    let yt;
    try {
      yt = (await ytsr(query, { limit: 1 })).items[0];
    } catch (err) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to search YouTube.' }
      });
    }

    if (!yt?.url) return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
      recipient: { id },
      message: { text: '❌ No YouTube video found.' }
    });

    const videoUrl = yt.url;
    const gn = Buffer.from(videoUrl).toString('base64');

    // Step 2: Get convertURL
    let convertURL;
    try {
      const { data: initRes } = await axios.get(`${BASE_INIT_URL}?gn=${gn}`, {
        headers: {
          'x-auth-key': 'k11lKcdXbfZ9N',
          'Origin': 'https://y2mate.nu',
          'Referer': 'https://y2mate.nu/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
        }
      });

      if (!initRes.convertURL) throw new Error('Missing convertURL');
      convertURL = initRes.convertURL;
    } catch (err) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Could not initialize download session.' }
      });
    }

    // Step 3: Follow redirect or download URL
    let downloadURL, finalTitle;
    try {
      const { data: step2 } = await axios.get(convertURL, {
        headers: {
          'Origin': 'https://y2mate.nu',
          'Referer': 'https://y2mate.nu/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
        }
      });

      const urlToFollow = step2.redirect ? step2.redirectURL : convertURL;
      const { data: step3 } = await axios.get(urlToFollow, {
        headers: {
          'Origin': 'https://y2mate.nu',
          'Referer': 'https://y2mate.nu/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
        }
      });

      downloadURL = step3.downloadURL;
      finalTitle = step3.title || yt.title;
    } catch (err) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Could not retrieve MP3 download URL.' }
      });
    }

    if (!downloadURL) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ No MP3 download link available.' }
      });
    }

    // Step 4: Download MP3
    const filename = `mp3_${id}_${Date.now()}.mp3`;
    const filepath = path.join(TMP_DIR, filename);
    try {
      const res = await axios({ url: downloadURL, method: 'GET', responseType: 'stream' });
      const writer = fs.createWriteStream(filepath);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (err) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to download MP3 file.' }
      });
    }

    // Step 5: Send MP3 to Facebook
    try {
      const form = new FormData();
      form.append('recipient', JSON.stringify({ id }));
      form.append('message', JSON.stringify({
        attachment: { type: 'audio', payload: {} }
      }));
      form.append('filedata', fs.createReadStream(filepath));

      await axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, form, {
        headers: form.getHeaders()
      });
    } catch (err) {
      await axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to send MP3 to Messenger.' }
      });
    } finally {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
  }
};