const axios = require('axios');
const ytsr = require('@distube/ytsr');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const TMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const CONVERT_HOST = 'https://nmuu.mnuu.nu';
const HEADERS = {
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
  Referer: 'https://y2mate.nu/',
  'Accept-Encoding': 'gzip, deflate, br, zstd'
};

module.exports = {
  name: 'mp3',
  description: 'Search YouTube and send MP3 to Messenger.',
  usage: '-mp3 <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args.length) {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Please provide a song title.' }
      });
    }

    // Step 1: YouTube search
    const query = args.join(' ') + ' official music video';
    let yt;
    try {
      yt = (await ytsr(query, { limit: 1 })).items[0];
    } catch {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ YouTube search failed.' }
      });
    }

    if (!yt?.url) return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
      recipient: { id },
      message: { text: '❌ No video found.' }
    });

    const videoId = new URL(yt.url).searchParams.get('v');
    if (!videoId) return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
      recipient: { id },
      message: { text: '❌ Failed to extract video ID.' }
    });

    // Step 2: Request convert
    const sig = encodeURIComponent(Date.now().toString(36) + Math.random().toString(36).slice(2)); // dummy to trigger redirect
    const convertUrl = `${CONVERT_HOST}/api/v1/convert?sig=${sig}&v=${videoId}&f=mp3&_=${Math.random()}`;

    let finalUrl;
    try {
      const res1 = await axios.get(convertUrl, { headers: HEADERS });
      if (res1.data.redirect && res1.data.redirectURL) {
        const res2 = await axios.get(res1.data.redirectURL, { headers: HEADERS });
        finalUrl = res2.data.downloadURL;
        yt.title = res2.data.title || yt.title;
      } else {
        finalUrl = res1.data.downloadURL;
        yt.title = res1.data.title || yt.title;
      }
    } catch {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to get download link.' }
      });
    }

    if (!finalUrl) return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
      recipient: { id },
      message: { text: '❌ No valid MP3 link found.' }
    });

    // Step 3: Download MP3
    const filename = `mp3_${id}_${Date.now()}.mp3`;
    const filepath = path.join(TMP_DIR, filename);
    try {
      const fileRes = await axios({ url: finalUrl, method: 'GET', responseType: 'stream' });
      const writer = fs.createWriteStream(filepath);
      fileRes.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch {
      return axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to download MP3.' }
      });
    }

    // Step 4: Send audio
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
    } catch {
      await axios.post(`https://graph.facebook.com/v23.0/me/messages?access_token=${token}`, {
        recipient: { id },
        message: { text: '❌ Failed to send audio.' }
      });
    } finally {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
  }
};