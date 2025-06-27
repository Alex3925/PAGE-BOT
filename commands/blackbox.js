const axios = require('axios'), { sendMessage } = require('../handles/sendMessage');

const boldMap = Object.fromEntries([...`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 `].map(c =>
  [c, String.fromCodePoint(c.charCodeAt(0) + (/[\da-z]/.test(c) ? c <= '9' ? 0x1D7CE - 48 : 0x1D41A - 97 : 0x1D400 - 65))]));
const bold = t => t.replace(/\*\*(.+?)\*\*/g, (_, w) => [...w].map(c => boldMap[c] || c).join(''));
const chunk = (t, s = 1900) => t.match(new RegExp(`.{1,${s}}`, 'gs')) || [];
const head = '💬 | 𝙱𝚕𝚊𝚌𝚔𝚋𝚘𝚡 𝙰𝚒\n・────────────・\n', foot = '\n・──── >ᴗ< ─────・';
const history = new Map();

module.exports = {
  name: 'blackbox',
  description: 'Chat with Blackbox AI',
  usage: 'blackbox [message]',
  author: 'coffee',

  async execute(senderId, args, token) {
    const prompt = args.join(' ') || 'Hi';
    const messages = [...(history.get(senderId) || []), { role: 'user', content: prompt }];
    const payload = {
      messages,
      id: senderId,
      codeModelMode: true,
      maxTokens: 1024,
      validated: '00f37b34-a166-4efb-bce5-1312d87f2f94',
      previewToken: null,
      userId: null,
      trendingAgentMode: {},
      isMicMode: false,
      userSystemPrompt: null,
      playgroundTopP: null,
      playgroundTemperature: null,
      isChromeExt: false,
      githubToken: '',
      clickedAnswer2: false,
      clickedAnswer3: false,
      clickedForceWebSearch: false,
      visitFromDelta: false,
      isMemoryEnabled: false,
      mobileClient: false,
      userSelectedModel: null,
      imageGenerationMode: false,
      imageGenMode: 'autoMode',
      webSearchModePrompt: false,
      deepSearchMode: false,
      domains: null,
      vscodeClient: false,
      codeInterpreterMode: false,
      customProfile: {
        name: '',
        occupation: '',
        traits: [],
        additionalInfo: '',
        enableNewChats: false
      },
      webSearchModeOption: {
        autoMode: true,
        webMode: false,
        offlineMode: false
      },
      session: null,
      isPremium: false,
      subscriptionCache: null,
      beastMode: false,
      reasoningMode: false,
      designerMode: false,
      workspaceId: '',
      asyncMode: false,
      integrations: {},
      isTaskPersistent: false,
      selectedElement: null
    };

    try {
      const res = await axios.post('https://www.blackbox.ai/api/chat', payload, {
        headers: {
          'content-type': 'application/json',
          'origin': 'https://www.blackbox.ai',
          'referer': `https://www.blackbox.ai/chat/${senderId}`,
          'sec-ch-ua-platform': '"Android"',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
          'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          'sec-ch-ua-mobile': '?1',
          'accept': '*/*',
          'sec-gpc': '1',
          'accept-language': 'en-US,en;q=0.8',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'cookie': 'sessionId=336f68f2-86a9-4653-a5b5-b26e4c5f04d1; render_app_version_affinity=dep-d1f9t3vgi27c73civb40; intercom-id-x55eda6t=1325ddeb-f371-44c5-a740-4fa91af9b5e5; intercom-session-x55eda6t=; intercom-device-id-x55eda6t=caba25ea-2427-4046-817e-dbfa4cdfd569',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
          'priority': 'u=1, i'
        }
      });

      let out = typeof res.data === 'string' ? res.data : '';
      out = bold(out.replace(/\$~~~\$.*?\$~~~\$/gs, '').trim());
      history.set(senderId, [...messages, { role: 'assistant', content: out }].slice(-20));

      for (const [i, part] of chunk(out).entries())
        await sendMessage(senderId, { text: (i ? '' : head) + part + (i === chunk(out).length - 1 ? foot : '') }, token);
    } catch {
      await sendMessage(senderId, { text: head + '❌ Failed to reach Blackbox.\n' + foot }, token);
    }
  }
};