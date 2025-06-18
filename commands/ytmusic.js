const axios = require('axios');
const ytsr = require('@distube/ytsr');
const { sendMessage } = require('../handles/sendMessage');

const BASE = 'https://snap-video3.p.rapidapi.com/download';
const KEYS = [
  '28077613bemshd5a2d7ee4aea83ep17d768jsn7e4822c17d3c',
  'f57934713bmsh0908331ee7d7995p1eb74bjsn58a1545c7d58'
];

let i = 0;

module.exports = {
  name: 'ytmusic',
  description: 'Searches for songs on YouTube and provides audio links.',
  usage: '-ytmusic <song name>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0]) return sendMessage(id, { text: 'Error: Please provide a song title.' }, token);
    const s = (await ytsr(`${args.join(' ')}, official music video.`, { limit: 1 })).items[0];
    if (!s) return sendMessage(id, { text: 'Error: Could not find song.' }, token);

    const p = new URLSearchParams({ url: s.url });
    let d;

    for (let j = 0; j < KEYS.length; j++) {
      try {
        const { data } = await axios.post(BASE, p, {
          headers: {
            'x-rapidapi-key': KEYS[(i + j) % KEYS.length],
            'x-rapidapi-host': 'snap-video3.p.rapidapi.com',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        if (data?.medias?.length) {
          d = data;
          i = (i + j + 1) % KEYS.length;
          break;
        }
      } catch {}
    }

    if (!d) return sendMessage(id, { text: 'Error: All API keys have reached their usage limits.' }, token);
    const m = d.medias.find(x => x.extension === 'mp3');

    await sendMessage(id, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{ title: `🎧 Title: ${d.title}`, image_url: d.thumbnail, subtitle: `Duration: ${d.duration}` }]
        }
      }
    }, token);

    sendMessage(id, {
      attachment: m ? { type: 'audio', payload: { url: m.url } } : { text: 'Error: No mp3 file available.' }
    }, token);
  }
};