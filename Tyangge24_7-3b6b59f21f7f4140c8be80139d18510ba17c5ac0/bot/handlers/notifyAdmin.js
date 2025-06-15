// admin.js
import { Order, PendingOrderApproval } from "../../models/index.js";
import { reverseGeocode } from "../services/geocode.js";
import { createXenditPayment } from "../services/xendit.js";
import { bot } from "../index.js";

async function generateAdminOrderSummary(order) {
  let text = "🛒 <b>NEW ORDER ALERT!</b>\n\n";
  order.items.forEach((item, idx) => {
    const name = item.variantName
      ? `${item.productName} (${item.variantName})`
      : item.productName;
    const subtotal = item.price * item.quantity;
    text += `${idx + 1}. ${name} — ₱${item.price} x ${item.quantity} = ₱${subtotal}\n`;
  });

  text += `\n💅 Subtotal: ₱${order.subtotal}`;
  text += `\n🚚 Delivery Fee: ₱${order.deliveryFee}`;
  text += `\n\n💎 <b>GRAND TOTAL:</b> ₱${order.total}`;
  text += `\n\n👤 Pangalan: ${order.customerInfo.name}`;
  text += `\n📱 Number: ${order.customerInfo.contact}`;

  if (
    order.customerInfo.location?.latitude &&
    order.customerInfo.location?.longitude
  ) {
    const barangay = await reverseGeocode(
      order.customerInfo.location.latitude,
      order.customerInfo.location.longitude
    );
    text += `\n📍 Barangay: ${barangay || "N/A"}`;
  }

  text += `\n📝 Address Note: ${order.customerInfo.addressNote || "Wala"}`;
  text += `\n📦 Status: <b>${order.status}</b>`;

  return text;
}

export async function notifyAdmin(pendingOrder) {
  const summary = await generateAdminOrderSummary(pendingOrder);
  await bot.api.sendMessage(process.env.ADMIN_TELEGRAM_ID, summary, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Approve & Send Payment",
            callback_data: `approve_${pendingOrder._id}`,
          },
          {
            text: "❌ Decline",
            callback_data: `decline_${pendingOrder._id}`,
          },
        ],
      ],
    },
  });
}

export function setupAdminCallbacks(bot) {
  bot.callbackQuery(/^(approve|decline)_(.*)$/, async (ctx) => {
    const [, action, pendingId] = ctx.match;
    const pendingOrder = await PendingOrderApproval.findById(pendingId);
    if (!pendingOrder) {
      return await ctx.answerCallbackQuery({
        text: "Pending order not found!",
        show_alert: true,
      });
    }

    const userId = pendingOrder.telegramId;

    if (action === "approve") {
      const newOrder = new Order({
        ...pendingOrder.toObject(),
        status: "awaiting_payment",
      });
      await newOrder.save();
      await PendingOrderApproval.findByIdAndDelete(pendingId);

      const payment = await createXenditPayment(newOrder);
      const paymentText = `🌈 <b>Confirmed ang order mo, dai!</b>\n\nI-check mo QR or link below para makabayad ka na:\n\n🔗 ${payment.invoice_url}\n\nPag nakabayad ka na, send mo lang proof dito sa bot. 💌`;

      try {
        await bot.api.sendMessage(userId, paymentText, {
          parse_mode: "HTML",
        });
      } catch (err) {
        console.error("❌ Failed to send payment message:", err);
      }

      await ctx.editMessageText("✅ Order approved and payment sent to customer!");
    }

    if (action === "decline") {
      await PendingOrderApproval.findByIdAndDelete(pendingId);

      try {
        await bot.api.sendMessage(
          userId,
          "❌ Sorry, dai. Na-decline ni admin ang imo order. If this was a mistake, try again or contact us ha. 💔"
        );
      } catch (err) {
        console.error("❌ Failed to send decline message:", err);
      }

      await ctx.editMessageText("🚫 Order declined.");
    }

    await ctx.answerCallbackQuery();
  });
}
