const axios = require('axios'); const ytsr = require('@distube/ytsr'); const { sendMessage } = require('../handles/sendMessage'); const fs = require('fs'); const FormData = require('form-data'); const path = require('path');

module.exports = { name: 'test', description: 'Searches for songs on YouTube and sends the lowest quality MP3 to Messenger.', usage: '-ytmusic <song name>', author: 'coffee',

async execute(id, args, token) { if (!args[0]) return sendMessage(id, { text: 'Error: Please provide a song title.' }, token);

const search = await ytsr(`${args.join(' ')} official music video`, { limit: 1 });
const result = search.items[0];
if (!result) return sendMessage(id, { text: 'Error: Could not find song.' }, token);

const videoId = new URL(result.url).searchParams.get('v');
let data;

try {
  const res = await axios.get(`https://c01-h01.cdnframe.com/api/v4/info/${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
      'Referer': 'https://clickapi.net',
      'Origin': 'https://clickapi.net',
      'Accept': 'application/json'
    }
  });
  data = res.data;
} catch (err) {
  return sendMessage(id, { text: 'Error: Could not retrieve audio data.' }, token);
}

const audioList = data?.formats?.audio?.mp3;
if (!audioList || !audioList.length) return sendMessage(id, { text: 'Error: No MP3 audio found.' }, token);

const lowest = audioList.sort((a, b) => a.quality - b.quality)[0];
const downloadUrl = `https://cdnframe.com/api/v4/stream/${lowest.token}`;
const filePath = path.resolve(__dirname, '../temp/audio.mp3');

try {
  const writer = fs.createWriteStream(filePath);
  const audioStream = await axios.get(downloadUrl, { responseType: 'stream' });
  audioStream.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
} catch (err) {
  return sendMessage(id, { text: 'Error: Failed to download MP3 file.' }, token);
}

try {
  const form = new FormData();
  form.append('recipient', JSON.stringify({ id }));
  form.append('message', JSON.stringify({
    attachment: { type: 'audio', payload: {} }
  }));
  form.append('filedata', fs.createReadStream(filePath));

  await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, form, {
    headers: form.getHeaders()
  });
} catch (err) {
  return sendMessage(id, { text: 'Error: Failed to send audio to Messenger.' }, token);
} finally {
  fs.unlink(filePath, () => {}); // Auto delete downloaded file
}

await sendMessage(id, {
  attachment: {
    type: 'template',
    payload: {
      template_type: 'generic',
      elements: [{
        title: `🎧 Title: ${data.title}`,
        image_url: data.thumbnail,
        subtitle: `Audio Quality: ${lowest.quality} kbps`
      }]
    }
  }
}, token);

} };

