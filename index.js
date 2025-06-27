const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = 'pagebot';
const PAGE_ACCESS_TOKEN = fs.readFileSync('token.txt', 'utf8').trim();
const COMMANDS_PATH = path.join(__dirname, 'commands');

app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

app.post('/webhook', (req, res) => {
  const { body } = req;

  if (body.object === 'page') {
    body.entry?.forEach(entry => {
      entry.messaging?.forEach(event => {
        if (event.message) {
          handleMessage(event, PAGE_ACCESS_TOKEN);
        } else if (event.postback) {
          handlePostback(event, PAGE_ACCESS_TOKEN);
        }
      });
    });
    return res.status(200).send('EVENT_RECEIVED');
  }

  res.sendStatus(404);
});

const httpsAgent = new https.Agent({ family: 4 });

const sendMessengerProfileRequest = async (method, url, data = null) => {
  try {
    const response = await axios({
      method,
      url: `https://graph.facebook.com/v23.0${url}?access_token=${PAGE_ACCESS_TOKEN}`,
      headers: { 'Content-Type': 'application/json' },
      data,
      timeout: 10000,
      httpsAgent
    });
    return response.data;
  } catch (error) {
    const detail = error.response?.data || error.message || error;
    console.error(`❌ Error during ${method.toUpperCase()} ${url}:\n`, detail);
    throw error;
  }
};

const loadCommands = () => {
  return fs.readdirSync(COMMANDS_PATH)
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const command = require(path.join(COMMANDS_PATH, file));
      return command.name && command.description
        ? { name: command.name, description: command.description }
        : null;
    })
    .filter(Boolean);
};

const loadMenuCommands = async (isReload = false) => {
  const commands = loadCommands();

  if (isReload) {
    await sendMessengerProfileRequest('delete', '/me/messenger_profile', { fields: ['commands'] });
    console.log('🗑️  Menu commands deleted.');
  }

  await sendMessengerProfileRequest('post', '/me/messenger_profile', {
    commands: [{ locale: 'default', commands }],
  });

  console.log('✅ Menu commands loaded.');
};

fs.watch(COMMANDS_PATH, (eventType, filename) => {
  if (['change', 'rename'].includes(eventType) && filename.endsWith('.js')) {
    loadMenuCommands(true).catch(error => {
      console.error('❌ Error reloading menu commands:', error);
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  try {
    await loadMenuCommands();
  } catch (error) {
    console.error('❌ Error loading initial menu commands:', error);
  }
});