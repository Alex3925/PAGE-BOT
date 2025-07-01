const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'spotify',
  description: 'Downloads a Spotify track using Spotmate.',
  usage: '-spotify <spotify track url>',
  author: 'coffee',

  async execute(id, args, token) {
    if (!args[0] || !args[0].includes('spotify.com/track'))
      return sendMessage(id, { text: 'Error: Please provide a valid Spotify track URL.' }, token);

    const spotifyUrl = args[0];

    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': 'Iyls0bYhyBzCK2QEpdDH9rsTdUC43vHhqYDcj68n',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      'Referer': 'https://spotmate.online/en',
      'Origin': 'https://spotmate.online',
      'Cookie': [
        'XSRF-TOKEN=eyJpdiI6Ik5Vc29uQ0lFKzhMdEF4UFZxMG55N3c9PSIsInZhbHVlIjoiSlRxZ3AzTGpNK1YvZWRhU1Rmb0JDa3MxcWVCTDdDU1RtbGJvUXQycUpNaG9ZYnVZOVBBd3IrcUxqYmN3dmFQeW1YYW9wbjRML1lva2VDUlJ3cm01UEwyVlBRTW5XaFVaenhWbjdCV1U3RzJOUzk5clZaUm54VEd0ZUQ1WjFTMmwiLCJtYWMiOiJmYzJkMmQzODU4YzkwYThhYjNiZTdlZDU2NjE2YmIxOThlNzVhYTViNTBiZGQ1YjI3ZGU1MDNkMDc4YzMwMzc5IiwidGFnIjoiIn0%3D',
        'spotmateonline_session=eyJpdiI6InAwL25MMElXTUFmKzN6TmhrSHkwdkE9PSIsInZhbHVlIjoibWVoWStXd0V0U1p2YUhXQ1NrK0V1M1lGQXBzcmlFbURPRU1YbkRRV1l3MkIvRFZaMjNBdEJDYWFrcll5eUVIZkJLVUtoZlZxNTNWRGluKzYxVFZnSGpvUUU3QUthTEFMTHRFWmExeDFxM3ZNR0VndFZjeEtRaVdyZUp3UjN3MU4iLCJtYWMiOiIzZjc0ODI4NTlhMDU1NTQxZWJjMmEyMTI3YmIwMDkxOTRjNmE1M2UzOWJlZDgxN2RkNzA2NTI1ZTJlYzI2YzFjIiwidGFnIjoiIn0%3D'
      ].join('; ')
    };

    try {
      const trackRes = await axios.post('https://spotmate.online/getTrackData', {
        spotify_url: spotifyUrl
      }, { headers });

      const track = trackRes.data;

      const convertRes = await axios.post('https://spotmate.online/convert', {
        urls: spotifyUrl
      }, { headers });

      if (convertRes.data?.error || !convertRes.data?.url)
        return sendMessage(id, { text: 'Error: Could not generate download link.' }, token);

      const audioUrl = decodeURIComponent(new URLSearchParams(convertRes.data.url.split('?')[1]).get('link'));

      await sendMessage(id, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: `🎵 ${track.name}`,
              image_url: track.album?.images?.[0]?.url,
              subtitle: `By ${track.artists?.map(a => a.name).join(', ')}`
            }]
          }
        }
      }, token);

      sendMessage(id, {
        attachment: {
          type: 'audio',
          payload: { url: audioUrl }
        }
      }, token);

    } catch (error) {
      sendMessage(id, { text: 'Error: Failed to fetch Spotify track or download link.' }, token);
    }
  }
};