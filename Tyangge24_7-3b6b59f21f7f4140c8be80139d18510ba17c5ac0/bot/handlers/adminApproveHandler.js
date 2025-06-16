import axios from "axios";
import { bot } from "../bot/index.js";
import { Order, PendingOrderApproval } from "../models/index.js";

/**
 * Approve a pending order, move it to Orders, create Xendit invoice, and send payment link.
 * Call this in your bot callback handler, e.g.:
 *   bot.callbackQuery(/approve_(.+)/, handleAdminApproval);
 */
export async function handleAdminApproval(ctx) {
  const orderId = ctx.match[1];
  const pendingOrder = await PendingOrderApproval.findById(orderId);
  if (!pendingOrder) return ctx.reply("Order not found!");

  // Move to Orders collection, preserving all order data
  const order = new Order({ ...pendingOrder.toObject(), status: "approved" });
  await order.save();
  await pendingOrder.deleteOne();

  // Create Xendit invoice
  const xenditApiKey = process.env.XENDIT_API_KEY;
  let invoiceRes;
  try {
    invoiceRes = await axios.post(
      "https://api.xendit.co/v2/invoices",
      {
        external_id: order.orderNumber,
        payer_email: "customer@email.com", // Replace or use phone if available
        amount: order.total,
        description: `Order #${order.orderNumber}`,
      },
      {
        auth: {
          username: xenditApiKey,
          password: "",
        },
      }
    );
  } catch (err) {
    console.error("❌ Xendit invoice creation failed:", err?.response?.data || err.message);
    return ctx.reply("Failed to create payment invoice. Please try again or check Xendit dashboard.");
  }

  const invoiceUrl = invoiceRes.data.invoice_url;

  // Send payment link to customer
  await bot.api.sendMessage(
    order.telegramId,
    `💸 Please pay for your order using this secure link:\n${invoiceUrl}`
  );

  // Notify admin
  await ctx.reply("Payment link sent to customer!");
}
