import { InlineKeyboard } from "grammy";
import { config } from "../../config/env.js";
import { PendingOrderApproval, Order } from "../../models/index.js";
import { createXenditPayment } from "../services/xendit.js";

// Notify admin with approve/decline buttons using PendingOrderApproval._id
export async function notifyAdmin(bot, order, pendingOrder) {
  const keyboard = new InlineKeyboard()
    .text("✅ Approve", `approve_${pendingOrder._id}`)
    .text("❌ Decline", `decline_${pendingOrder._id}`);

  const summary = `
📢 <b>ORDER FOR APPROVAL</b>
🆔 Order #: ${order.orderNumber}
👤 Name: ${order.customerInfo.name}
📱 Contact: ${order.customerInfo.contact}
🏡 Address: ${order.customerInfo.location.resolvedAddress}
📝 Note: ${order.customerInfo.addressNote}
💰 Total: ₱${order.total}
`;

  await bot.api.sendMessage(
    config.ADMIN_CHAT_ID,
    summary,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
}

// Setup admin callback handlers for order approval
export function setupAdminCallbacks(bot) {
  // Handles both approve and decline
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

      // Create payment and send to user
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
