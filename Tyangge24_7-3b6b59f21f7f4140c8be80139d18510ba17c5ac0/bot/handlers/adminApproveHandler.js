import axios from "axios";
import { bot } from "../index.js";
import { Order, PendingOrderApproval, PaymentTransaction } from "../../models/index.js";
import { createXenditQRPHInvoice } from "./xenditQRPH.js"; // Make sure this exists

export async function handleAdminApproval(ctx) {
  const orderId = ctx.match[1];
  const pendingOrder = await PendingOrderApproval.findById(orderId);
  if (!pendingOrder) return ctx.reply("Order not found!");

  // Move to Orders collection
  const order = new Order({ ...pendingOrder.toObject(), status: "approved" });
  await order.save();
  await pendingOrder.deleteOne();

  // ✅ Create QRPH invoice
  try {
    const qrphInvoice = await createXenditQRPHInvoice(order.total, order.customerInfo.name, order.customerInfo.contact, order.telegramId);

    // Save QRPH invoice to PaymentTransaction
    await PaymentTransaction.create({
      orderId: order._id,
      type: "qrph",
      status: "pending",
      amount: order.total,
      qrCodeUrl: qrphInvoice.url,
      xenditInvoiceId: qrphInvoice.xenditInvoiceId,
    });

    await bot.api.sendPhoto(order.telegramId, qrphInvoice.qrCodeUrl, {
      caption: `💸 *Scan this QR code to pay via QRPH!*

*Order #${order.orderNumber}*
₱${order.total}

After paying, we’ll notify you once confirmed. Thank you, beshie! 💖`,
      parse_mode: "Markdown",
    });

    await ctx.reply("QRPH payment QR sent to customer!");
  } catch (err) {
    console.error("❌ Failed to create QRPH invoice:", err?.response?.data || err.message);
    return ctx.reply("Failed to create payment QR. Please check Xendit dashboard or try again.");
  }
}
