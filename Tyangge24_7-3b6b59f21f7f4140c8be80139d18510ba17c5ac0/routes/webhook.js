import express from "express";
import { Order } from "../models/index.js"; // ✅ using index.js
import { bot } from "../bot/index.js"; // ✅ assuming bot instance is exported here

const router = express.Router();

router.post("/xendit", async (req, res) => {
  const event = req.body;

  try {
    const external_id = event?.data?.external_id;
    const status = event?.data?.status;

    if (!external_id || !status) return res.sendStatus(400);

    // Find order using orderNumber as external_id
    const order = await Order.findOne({ orderNumber: external_id });
    if (!order) return res.sendStatus(404);

    if (status === "PAID") {
      order.paymentStatus = "paid";
      order.status = "paid";
      order.updatedAt = new Date();
      await order.save();

      // Notify customer
      await bot.api.sendMessage(order.telegramId, `
💸 *Payment Received!*  
Your order *#${order.orderNumber}* is now *CONFIRMED* and will be prepared shortly!

⏳ Status updates will be sent here. Stay tuned, mare!
`.trim(), { parse_mode: "Markdown" });

      // Optional: Notify admin
      await bot.api.sendMessage(
        process.env.ADMIN_TELEGRAM_ID || "7699555744",
        `✅ *New payment received!*\nOrder: #${order.orderNumber}\nAmount: ₱${order.total}`,
        { parse_mode: "Markdown" }
      );

      // Start Timeline: Preparing (after 2 mins)
      setTimeout(async () => {
        order.status = "preparing";
        order.updatedAt = new Date();
        await order.save();

        await bot.api.sendMessage(order.telegramId, "👩‍🍳 *Preparing na ang order mo, mare!* Kakain ka na lang, char! 😋", {
          parse_mode: "Markdown"
        });
      }, 2 * 60 * 1000);

      // En Route (after another 3 mins)
      setTimeout(async () => {
        order.status = "en_route";
        order.updatedAt = new Date();
        await order.save();

        await bot.api.sendMessage(order.telegramId, "🛵 *Padulong na siya, dai!* G ka na ba? Kasi siya ready na. 😘", {
          parse_mode: "Markdown"
        });
      }, 5 * 60 * 1000);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});

export default router;
