import axios from "axios";
import { bot } from "../index.js";
import { Order, PendingOrderApproval, PaymentTransaction } from "../../models/index.js";
import { createXenditQRPHQRCode as createXenditQRPHInvoice } from "../services/xendit.js"; // alias for clarity

export async function handleAdminApproval(ctx) {
  const orderId = ctx.match[1];

  const pendingOrder = await PendingOrderApproval.findById(orderId);
  if (!pendingOrder) return ctx.reply("❌ Order not found, besh!");

  // ✅ Move to Orders collection
  const order = new Order({
    ...pendingOrder.toObject(),
    status: "approved",
  });

  await order.save();
  await pendingOrder.deleteOne();

  try {
    // 🔄 Generate QR code via Xendit
    const { xenditQRString: qrString, qrImageBuffer, qrId } = await createXenditQRPHInvoice(
      order.total,
      order.orderNumber,
      order.telegramId
    );

    // 🏷️ Use orderNumber as referenceId for now
    const referenceId = `ref-${order.orderNumber}`;

    // 💾 Save payment tracking info
    await PaymentTransaction.create({
      orderId: order._id,
      type: "qrph",
      status: "pending",
      amount: order.total,
      referenceId,
      qrId,
    });

    // 📤 Send QR to customer
    await bot.api.sendPhoto(order.telegramId, { source: qrImageBuffer }, {
      caption: `📲 *Scan this QR Code to pay via GCash, Maya, or any QR Ph app!*\n\n🧾 *Order #${order.orderNumber}*\n💰 *Amount:* ₱${order.total}\n\n_Payment will be auto-confirmed. Thank you, accla!_ 💖`,
      parse_mode: "Markdown",
    });

    await ctx.reply("✅ Payment QR sent to customer!");
  } catch (err) {
    console.error("❌ Failed to generate QRPH invoice:", err?.response?.data || err.message);

    await ctx.reply("⚠️ Failed to generate QR. Try again or check the Xendit dashboard.");
  }
}
