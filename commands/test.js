const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'test',
  description: 'A placeholder command for testing.',
  usage: 'test',
  author: 'You',

  async execute(senderId, args, pageAccessToken) {
    // This command intentionally does nothing.
    await sendMessage(senderId, { text: 'Test command executed (does nothing).' }, pageAccessToken);
  }
};