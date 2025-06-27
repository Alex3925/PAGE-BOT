const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = 'pagebot';
const PAGE_ACCESS_TOKEN = fs.readFileSync('token.txt', 'utf8').trim();
const COMMANDS_PATH = path.join(__dirname, 'commands');

// Webhook verification
app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  res.sendStatus(400); // Bad request if neither mode nor token are provided
});

// Webhook event handling
app.post('/webhook', (req, res) => {
  const { body } = req;

  if (body.object === 'page') {
    // Ensure entry and messaging exist before iterating
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

// Helper function for Axios requests
const sendMessengerProfileRequest = async (method, url, data = null) => {
  try {
    const response = await axios({
      method,
      url: `https://graph.facebook.com/v23.0${url}?access_token=${PAGE_ACCESS_TOKEN}`,
      headers: { 'Content-Type': 'application/json' },
      data
    });
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} request:`, error.response?.data || error.message);
    throw error;
  }
};

// Load all command files from the "commands" directory
const loadCommands = () => {
  return fs.readdirSync(COMMANDS_PATH)
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const command = require(path.join(COMMANDS_PATH, file));
      return command.name && command.description ? { name: command.name, description: command.description } : null;
    })
    .filter(Boolean);
};

// Load or reload Messenger Menu Commands dynamically
const loadMenuCommands = async (isReload = false) => {
  const commands = loadCommands();

  if (isReload) {
    // Delete existing commands if reloading
    await sendMessengerProfileRequest('delete', '/me/messenger_profile', { fields: ['commands'] });
    console.log('Menu commands deleted successfully.');
  }

  // Load new or updated commands
  await sendMessengerProfileRequest('post', '/me/messenger_profile', {
    commands: [{ locale: 'default', commands }],
  });

  console.log('Menu commands loaded successfully.');
};

// Watch for changes in the commands directory and reload the commands
fs.watch(COMMANDS_PATH, (eventType, filename) => {
  if (['change', 'rename'].includes(eventType) && filename.endsWith('.js')) {
    loadMenuCommands(true).catch(error => {
      console.error('Error reloading menu commands:', error);
    });
  }
});

// Server initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // Load Messenger Menu Commands asynchronously after the server starts
  try {
    await loadMenuCommands(); // Load commands without deleting (initial load)
  } catch (error) {
    console.error('Error loading initial menu commands:', error);
  }
});