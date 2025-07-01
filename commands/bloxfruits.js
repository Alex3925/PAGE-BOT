const { sendMessage } = require("../handles/sendMessage");
const axios = require("axios");
const activeSessions = new Map();
const lastSentCache = new Map();
const PH_TIMEZONE = "Asia/Manila";

function pad(n) { return n < 10 ? "0" + n : n; }

function getPHTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: PH_TIMEZONE }));
}

function getCountdown(target) {
  const now = getPHTime();
  const msLeft = target - now;
  if (msLeft <= 0) return "00h 00m 00s";
  const h = Math.floor(msLeft / 3.6e6);
  const m = Math.floor((msLeft % 3.6e6) / 6e4);
  const s = Math.floor((msLeft % 6e4) / 1000);
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function getNextRestocks() {
  const now = getPHTime();
  const timers = {};

  // Dealer stock (normalStock): every 4 hours (e.g., 00:00, 04:00, 08:00, ...)
  const dealerNext = new Date(now);
  const dealerHours = Math.ceil(now.getHours() / 4) * 4;
  dealerNext.setHours(dealerHours, 0, 0, 0);
  timers.dealer = getCountdown(dealerNext);

  // Advanced Dealer stock (mirageStock): every 2 hours (e.g., 00:00, 02:00, 04:00, ...)
  const advDealerNext = new Date(now);
  const advDealerHours = Math.ceil(now.getHours() / 2) * 2;
  advDealerNext.setHours(advDealerHours, 0, 0, 0);
  timers.advDealer = getCountdown(advDealerNext);

  return timers;
}

function getNextScheduledTime(startTime = getPHTime()) {
  const base = new Date(startTime);
  const min = base.getMinutes();
  const next5 = Math.ceil(min / 5) * 5;
  base.setMinutes(next5, 0, 0);
  if (base <= startTime) base.setMinutes(base.getMinutes() + 5);
  return base;
}

function addEmoji(name) {
  const emojis = {
    "Rocket": "🚀", "Spin": "🌀", "Chop": "🪓", "Spring": "🪶", "Kilo": "⚖️",
    "Smoke": "💨", "Spike": "🦔", "Flame": "🔥", "Falcon": "🦅", "Ice": "❄️",
    "Sand": "🏜️", "Dark": "🌑", "Diamond": "💎", "Light": "💡", "Rubber": "🎈",
    "Barrier": "🛡️", "Magma": "🌋", "Quake": "🌍", "Buddha": "🕉️", "Love": "💕",
    "Spider": "🕷️", "Sound": "🎶", "Phoenix": "🦣", "Portal": "🌀", "Rumble": "⚡",
    "Pain": "😣", "Blizzard": "❄️", "Gravity": "🌌", "Mammoth": "🦣", "T-Rex": "🦖",
    "Dough": "🍩", "Shadow": "👤", "Venom": "🐍", "Control": "🎮", "Spirit": "🐉",
    "Dragon": "🦁", "Leopard": "🐆", "Kitsune": "🦊", "Bomb": "💣", "Blade": "🗡️", "Eagle": "🦅"
  };
  return `${emojis[name] || "🍎"} ${name}`;
}

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await axios.get(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

module.exports = {
  name: "bloxfruits",
  description: "Track Blox Fruits Dealer and Advanced Dealer stock and restocks.",
  usage: "bloxfruit on | bloxfruit on Dragon | Kitsune | bloxfruit off",
  author: "Alex Jhon Ponce"
  category: "Automation Tools ⚒️",

  async execute(senderId, args, pageAccessToken) {
    const action = args[0]?.toLowerCase();
    const filters = args.slice(1).join(" ").split("|").map(f => f.trim().toLowerCase()).filter(Boolean);

    if (action === "off") {
      const session = activeSessions.get(senderId);
      if (session) {
        clearTimeout(session.timeout);
        activeSessions.delete(senderId);
        lastSentCache.delete(senderId);
        return await sendMessage(senderId, { text: "🛑 Blox Fruits tracking stopped." }, pageAccessToken);
      }
      return await sendMessage(senderId, { text: "⚠️ You don't have an active Blox Fruits tracking session." }, pageAccessToken);
    }

    if (action !== "on") {
      return await sendMessage(senderId, {
        text: "📌 Usage:\n• bloxfruit on\n• bloxfruit on Dragon | Kitsune\n• bloxfruit off",
      }, pageAccessToken);
    }

    if (activeSessions.has(senderId)) {
      return await sendMessage(senderId, {
        text: "📡 You're already tracking Blox Fruits Stock. Use 'bloxfruit off' to stop.",
      }, pageAccessToken);
    }

    await sendMessage(senderId, { text: "✅ Blox Fruits tracking started! You'll be notified when stock changes." }, pageAccessToken);

    async function fetchAndNotify(alwaysSend = false) {
      try {
        const options = {
          method: "GET",
          url: "https://blox-fruit-stock-fruit.p.rapidapi.com/",
          headers: {
            "x-rapidapi-key": "839ada3b52mshbc4ed7e443a28a4p18b2aajsn3b451d55a2e5",
            "x-rapidapi-host": "blox-fruit-stock-fruit.p.rapidapi.com"
          },
        };

        const stockRes = await fetchWithTimeout(options.url, { headers: options.headers });
        const stockData = {
          dealer: (stockRes.data.normalStock || []).map(name => ({ name, stock: 1 })),
          advancedDealer: (stockRes.data.mirageStock || []).map(name => ({ name, stock: 1 })),
        };

        const restocks = getNextRestocks();
        const updatedAtPH = getPHTime().toLocaleString("en-PH", {
          hour: "numeric", minute: "numeric", second: "numeric", hour12: true,
          day: "2-digit", month: "short", year: "numeric"
        });

        let messageContent = "";
        let matched = 0;

        const formatStock = (items) => {
          const filtered = filters.length
            ? items.filter(item => filters.some(f => item.name.toLowerCase().includes(f)))
            : items;
          if (filtered.length) matched += filtered.length;
          return filtered
            .map(item => `- ${addEmoji(item.name)} ${item.name}: In Stock`)
            .join("\n") || "No matching stock.";
        };

        messageContent += `🛒 𝗗𝗲𝗮𝗹𝗲𝗿 𝗦𝘁𝗼𝗰𝗸:\n${formatStock(stockData.dealer)}\n⏳ Next Restock: ${restocks.dealer}\n\n`;
        messageContent += `🏪 𝗔𝗱𝘃𝗮𝗻𝗰𝗲𝗱 𝗗𝗲𝗮𝗹𝗲𝗿 𝗦𝘁𝗼𝗰𝗸:\n${formatStock(stockData.advancedDealer)}\n⏳ Next Restock: ${restocks.advDealer}\n\n`;

        // Skip if no matching items and filters are applied
        if (filters.length && matched === 0) return false;

        // Check for stock changes
        const currentKey = JSON.stringify(stockData);
        const lastSent = lastSentCache.get(senderId);
        if (!alwaysSend && lastSent === currentKey) return false;
        lastSentCache.set(senderId, currentKey);

        const message = `🍎 𝗕𝗹𝗼𝘅 𝗙𝗿𝘂𝗶𝘁𝘀 — 𝗦𝘁𝗼𝗰𝗸 𝗧r𝗮𝗰𝗸𝗲𝗿\n\n${messageContent}📅 Updated at (Philippines): ${updatedAtPH}`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
        return true;

      } catch (error) {
        console.error("Fetch error:", error);
        return false;
      }
    }

    async function runSchedule() {
      const now = getPHTime();
      const nextTime = getNextScheduledTime(now);
      const wait = Math.max(nextTime - now, 1000);

      const timer = setTimeout(async function trigger() {
        const updated = await fetchAndNotify(false);
        if (updated) {
          runSchedule();
        } else {
          const retryTimer = setTimeout(trigger, 5000);
          activeSessions.set(senderId, { timeout: retryTimer });
        }
      }, wait);

      activeSessions.set(senderId, { timeout: timer });
    }

    await fetchAndNotify(true);
    runSchedule();
  },
};
