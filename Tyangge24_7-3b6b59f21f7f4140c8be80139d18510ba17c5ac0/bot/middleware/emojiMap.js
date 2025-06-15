export function getEmoji(productName = "") {
  const map = {
    "Cock Ring": "🍩",
    "Cock Ring Vibrator": "🍆⚡",
    "Spikey Jelly": "🧽",
    "Th Bolitas": "🔴🔴",
    "Monogatari": "💧🍑",
    "Maxman": "💊",
    "Condom": "🧴",
    "Vibrator": "🥚⚡",
    "Delay": "🛑🍑",
    "Dildo": "🍆🌍",
    "Masturbator": "👄🍑",
    "Freshener": "👅🌬️",
    "Ice Cube": "🧊",       // ← added!
    "Insulin": "💉",
    "Sterile Water": "💧",
  };

  for (const key in map) {
    if (productName.toLowerCase().includes(key.toLowerCase())) {
      return map[key];
    }
  }

  return "📦"; // fallback
}
