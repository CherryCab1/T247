import { Order } from "../../models/index.js";
import { reverseGeocode } from "../services/geocode.js";
import { createXenditPayment } from "../services/xendit.js";

// 🔹 Generate admin order summary
async function generateAdminOrderSummary(order) {
  let text = "🛒 <b>NEW ORDER ALERT!</b>\n\n";

  order.items.forEach((item, idx) => {
    const name = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
    const subtotal = item.price * item.quantity;
    text += `${idx + 1}. ${name} — ₱${item.price} x ${item.quantity} = ₱${subtotal}\n`;
  });

  text += `\n💅 Subtotal: ₱${order.subtotal}`;
  text += `\n🚚 Delivery Fee: ₱${order.deliveryFee}`;
  text += `\n\n💎 <b>GRAND TOTAL:</b> ₱${order.total}`;
  text += `\n\n👤 Pangalan: ${order.name}`;
  text += `\n📱 Number: ${order.mobile}`;

  if (order.location?.latitude && order.location?.longitude) {
    const barangay = await reverseGeocode(order.location.latitude, order.location.longitude);
    text += `\n📍 Barangay: ${barangay || "N/A"}`;
  }

  text += `\n📝 Address Note: ${order.addressNote || "Wala"}`;
  text += `\n📦 Status: <b>${order.status}</b>`;

  return text;
}

// 🔹 Notify admin
export async function notifyAdmin(user) {
  const { bot } = await import("../index.js"); // Lazy import to fix circular issue
  const order = await Order.findOne({ userId: user.telegramId, status: "pending" });
  if (!order) return;

  const summary = await generateAdminOrderSummary(order);

  await bot.api.sendMessage(
    process.env.ADMIN_TELEGRAM_ID,
    summary,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve & Send Payment", callback_data: `approve_${order._id}` },
            { text: "❌ Decline", callback_data: `decline_${order._id}` }
          ]
        ]
      }
    }
  );
}

// 🔹 Admin decision handler
export async function setupAdminCallbacks(bot) {
  bot.callbackQuery(/^(approve|decline)_(.*)$/, async (ctx) => {
    const [, action, orderId] = ctx.match;
    const order = await Order.findById(orderId);
    if (!order) return await ctx.answerCallbackQuery({ text: "Order not found!", show_alert: true });

    const userId = order.userId;

    if (action === "approve") {
      order.status = "awaiting_payment";
      await order.save();

      const payment = await createXenditPayment(order.total, order.name, order.mobile);
      const paymentText = `🌈 <b>Confirmed ang order mo, dai!</b>\n\nI-check mo QR or link below para makabayad ka na:\n\n🔗 ${payment.url}\n\nPag nakabayad ka na, send mo lang proof dito sa bot. 💌`;

      await ctx.api.sendMessage(userId, paymentText, { parse_mode: "HTML" });
      await ctx.editMessageText("✅ Order approved and payment sent to customer!");
    }

    if (action === "decline") {
      order.status = "declined";
      await order.save();
      await ctx.api.sendMessage(userId, "❌ Sorry, dai. Na-decline ni admin ang imo order. If this was a mistake, try again or contact us ha. 💔");
      await ctx.editMessageText("🚫 Order declined.");
    }

    await ctx.answerCallbackQuery();
  });
}
