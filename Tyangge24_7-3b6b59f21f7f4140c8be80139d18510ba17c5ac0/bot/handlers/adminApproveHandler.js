import axios from "axios";
import { bot } from "../index.js";
import { Order, PendingOrderApproval, PaymentTransaction } from "../../models/index.js";
import { createXenditQRPHInvoice } from "../services/xendit.js"; // make sure correct path

export async function handleAdminApproval(ctx) {
  const orderId = ctx.match[1];
  const pendingOrder = await PendingOrderApproval.findById(orderId);
  if (!pendingOrder) return ctx.reply("Order not found!");

  // Move to Orders collection
  const order = new Order({ ...pendingOrder.toObject(), status: "approved" });
  await order.save();
  await pendingOrder.deleteOne();

  try {
    // ✅ Create QRPH invoice — returns qrString and QR image buffer
    const { qrString, qrImageBuffer, referenceId, qrId } = await createXenditQRPHInvoice(
      order.total,
      order.customerInfo.name,
      order.customerInfo.contact,
      order.telegramId
    );

    // Save to PaymentTransaction
    await PaymentTransaction.create({
      orderId: order._id,
      type: "qrph",
      status: "pending",
      amount: order.total,
      referenceId,
      qrId,
    });

    // ✅ Send the image buffer as photo
    await bot.api.sendPhoto(order.telegramId, { source: qrImageBuffer }, {
      caption: `📲 *Scan this QR code to pay via QRPH!*\n\n🧾 *Order #${order.orderNumber}*\n💰 *Amount:* ₱${order.total}\n\nAfter paying, hintay lang for confirmation. Salamat gid, accla! 💖`,
      parse_mode: "Markdown",
    });

    await ctx.reply("✅ QRPH payment sent to customer!");
  } catch (err) {
    console.error("❌ Failed to create QRPH invoice:", err?.response?.data || err.message);
    return ctx.reply("⚠️ Failed to generate QR. Check Xendit dashboard or try again.");
  }
}
