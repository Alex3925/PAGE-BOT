const axios = require('axios'), { sendMessage } = require('../handles/sendMessage');
const b64 = s => Buffer.from(s, 'base64').toString(), B = (t, n = 1900) => t.match(new RegExp(`.{1,${n}}`, 'gs')) || [];
const bold = t => t.replace(/\*\*(.+?)\*\*/g, (_, x) => [...x].map(c =>
  /[a-z]/.test(c) ? String.fromCodePoint(c.charCodeAt(0)+0x1D41A-97) :
  /[A-Z]/.test(c) ? String.fromCodePoint(c.charCodeAt(0)+0x1D400-65) :
  /[0-9]/.test(c) ? String.fromCodePoint(c.charCodeAt(0)+0x1D7CE-48) : c).join(''));

const getImage = async (e, t) => {
  const m = e?.message?.reply_to?.mid || e?.message?.mid;
  if (!m) return null;
  try {
    const u = `${b64('aHR0cHM6Ly9ncmFwaC5mYWNlYm9vay5jb20vdjIzLjAv')}${m}/attachments`;
    const d = (await axios.get(u, { params: { access_token: t } })).data?.data?.[0];
    return d?.image_data?.url || d?.file_url || null;
  } catch { return null; }
};

module.exports = {
  name: 'test', description: 'Interact with ChatGPT', usage: 'ai <question>', author: 'Coffee',
  async execute(id, args, token, e, send, cache) {
    const q = args.join(' ').trim() || 'hello';
    let img = await getImage(e, token);
    if (!img && cache?.get(id)?.timestamp > Date.now() - 3e5) img = cache.get(id).url;
    const prompt = encodeURIComponent(img ? `${q}\n[Image: ${img}]` : q);
    const url = `${b64('aHR0cHM6Ly9rYWl6LWFwaXMuZ2xlZXplLmNvbS9hcGkvZ3B0LTRvP2Fzaz0=')}${prompt}${b64('JmFwaWtleT0wYmMxZTIwZS1lYzQ3LTRjOTItYTYxZi0xYzYyNmU3ZWRhYjcmV2ViU2VhcmNoPW9mZiZ1aWQ9')}${id}`;

    try {
      const res = await axios.get(url), txt = bold(res?.data?.response || '✅ No reply.');
      const pre = '💬 | 𝙲𝚑𝚊𝚝𝙶𝙿𝚃\n・───────────・\n', suf = '\n・──── >ᴗ< ────・';
      for (let [i, p] of B(txt).entries()) await send(id, (i ? '' : pre) + p + (i === B(txt).length - 1 ? suf : ''));
    } catch (err) {
      console.error('❌ AI error:', err?.response?.data || err.message);
      await send(id, '❌ Failed to contact ChatGPT.');
    }
  }
};