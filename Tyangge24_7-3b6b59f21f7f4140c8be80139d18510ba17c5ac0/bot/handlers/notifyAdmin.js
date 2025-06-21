import { InlineKeyboard } from "grammy";
import { config } from "../../config/env.js";
import { PendingOrderApproval, Order } from "../../models/index.js";
import { createXenditInvoice } from "../services/xendit.js";
import { reverseGeocode } from "../services/geocode.js";

// ✅ Notify admin with approve/decline buttons
export async function notifyAdmin(bot, pendingOrder) {
  const keyboard = new InlineKeyboard()
    .text("✅ Approve", `approve_${pendingOrder._id}`)
    .text("❌ Decline", `decline_${pendingOrder._id}`);

  let resolvedAddress = pendingOrder.customerInfo?.location?.resolvedAddress;
  if (
    (!resolvedAddress || resolvedAddress === "📍 Unknown address") &&
    pendingOrder.customerInfo?.location?.latitude &&
    pendingOrder.customerInfo?.location?.longitude
  ) {
    try {
      resolvedAddress = await reverseGeocode(
        pendingOrder.customerInfo.location.latitude,
        pendingOrder.customerInfo.location.longitude
      );
    } catch {
      resolvedAddress = "📍 [Location shared lang]";
    }
  }

  const summary = `
📢 <b>ORDER FOR APPROVAL</b>
🆔 Order #: ${pendingOrder.orderNumber}
👤 Name: ${pendingOrder.customerInfo?.name || "N/A"}
📱 Contact: ${pendingOrder.customerInfo?.contact || "N/A"}
🏡 Address: ${resolvedAddress || "N/A"}
📝 Note: ${pendingOrder.customerInfo?.addressNote || "None"}
💰 Total: ₱${pendingOrder.total}
`;

  console.log("📤 Sending approval message to admin...");
  await bot.api.sendMessage(config.ADMIN_CHAT_ID, summary, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

// ✅ Register approval/decline handler
export function registerOrderApprovalHandlers(bot) {
  console.log("🛠️ Registering approve/decline callback handler...");

  bot.callbackQuery(/^(approve|decline)_(.*)$/, async (ctx) => {
    console.log("🧲 Callback matched:", ctx.callbackQuery.data);

    const [, action, pendingId] = ctx.match;
    console.log("📦 Action:", action);
    console.log("🆔 Pending ID:", pendingId);

    const pendingOrder = await PendingOrderApproval.findById(pendingId);
    if (!pendingOrder) {
      console.warn("⚠️ Pending order not found.");
      try {
        await ctx.answerCallbackQuery({ text: "Pending order not found!", show_alert: true });
      } catch {}
      return;
    }

    const userId = pendingOrder.telegramId;

    if (action === "approve") {
      console.log("✅ Approving order...");
      const newOrder = new Order({
        ...pendingOrder.toObject(),
        status: "awaiting_payment",
      });
      await newOrder.save();
      await PendingOrderApproval.findByIdAndDelete(pendingId);

      const payment = await createXenditInvoice(
        newOrder.total,
        newOrder.customerInfo?.name,
        newOrder.customerInfo?.contact,
        newOrder.telegramId
      );

      const paymentText = `🌈 <b>Confirmed ang order mo, dai!</b>\n\nI-check mo QR or link below para makabayad ka na:\n\n🔗 ${payment.url}\n\nPag nakabayad ka na, send mo lang proof dito sa bot. 💌`;

      try {
        await bot.api.sendMessage(userId, paymentText, { parse_mode: "HTML" });
        console.log("📨 Payment link sent to user.");
      } catch (err) {
        console.error("❌ Failed to send payment message:", err);
      }

      try {
        await ctx.editMessageText("✅ Order approved and payment sent to customer!");
      } catch {}
    }

    if (action === "decline") {
      console.log("🚫 Declining order...");
      await PendingOrderApproval.findByIdAndDelete(pendingId);

      try {
        await bot.api.sendMessage(
          userId,
          "❌ Sorry, dai. Na-decline ni admin ang imo order. If this was a mistake, try again or contact us ha. 💔"
        );
      } catch (err) {
        console.error("❌ Failed to send decline message:", err);
      }

      try {
        await ctx.editMessageText("🚫 Order declined.");
      } catch {}
    }

    try {
      await ctx.answerCallbackQuery();
    } catch {}
  });
}
