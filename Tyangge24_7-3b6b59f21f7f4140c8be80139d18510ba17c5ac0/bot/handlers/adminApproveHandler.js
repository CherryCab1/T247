import axios from "axios";
import { bot } from "../index.js";
import { Order, PendingOrderApproval } from "../../models/index.js";

export async function handleAdminApproval(ctx) {
  const orderId = ctx.match[1];
  const pendingOrder = await PendingOrderApproval.findById(orderId);
  if (!pendingOrder) return ctx.reply("Order not found!");

  // Move to Orders collection
  const order = new Order({ ...pendingOrder.toObject(), status: "approved" });
  await order.save();
  await pendingOrder.deleteOne();

  // Build payload
  const invoicePayload = {
    external_id: String(order.orderNumber),
    amount: Number(order.total),
    description: `Order #${order.orderNumber}`,
    // Do NOT include payer_email unless you have a real value
  };

  console.log("Sending invoice to Xendit:", invoicePayload);

  const xenditApiKey = process.env.XENDIT_API_KEY;
  let invoiceRes;
  try {
    invoiceRes = await axios.post(
      "https://api.xendit.co/v2/invoices",
      invoicePayload,
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
  await bot.api.sendMessage(
    order.telegramId,
    `💸 Please pay for your order using this secure link:\n${invoiceUrl}`
  );
  await ctx.reply("Payment link sent to customer!");
}
