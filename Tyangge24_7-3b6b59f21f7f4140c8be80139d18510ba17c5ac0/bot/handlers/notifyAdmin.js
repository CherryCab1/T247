// notifyAdmin.js

import { bot } from "../bot.js";
import { getEmoji } from "../helpers/emojiMap.js";
import { config } from "../config/env.js";

const ADMIN_ID = config.ADMIN_TELEGRAM_ID; // or hardcode your admin ID here

export async function notifyAdmin(order) {
  const { customerName, contactNumber, deliveryOption, totalAmount, items, deliveryLocation, _id } = order;

  const itemsText = items.map((item) =>
    `• ${item.quantity}x ${getEmoji(item.name)} ${item.name}${item.variant ? ' – ' + item.variant : ''}`
  ).join('\n');

  const gmapsUrl = deliveryLocation?.latitude && deliveryLocation?.longitude
    ? `[View on Map](https://maps.google.com/?q=${deliveryLocation.latitude},${deliveryLocation.longitude})`
    : `Not provided`;

  const message = `
🛍️ *New Order Alert!*

👤 *Customer*: ${customerName}
🛒 *Items*:
${itemsText}
💸 *Total*: ₱${totalAmount}
📍 *Location*: ${gmapsUrl}

📦 *Delivery Option*: ${deliveryOption}
📞 *Contact*: ${contactNumber}
🆔 *Order ID*: #${_id}

🚦 Status: *Waiting for your approval, Fairy Gormother!*
`;

  await bot.api.sendMessage(ADMIN_ID, message, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirm", callback_data: `confirm_order:${_id}` },
          { text: "❌ Deny", callback_data: `deny_order:${_id}` },
        ]
      ]
    }
  });
}
