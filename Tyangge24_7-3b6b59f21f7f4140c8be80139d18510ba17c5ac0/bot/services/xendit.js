import axios from "axios"
import { Order, PaymentTransaction } from "../../models/index.js"
import { bot } from "../index.js"
import { config } from "../../config/env.js"

const env = process.env.XENDIT_ENV || "development"
const apiKey =
  env === "production"
    ? process.env.XENDIT_API_KEY_PROD
    : process.env.XENDIT_API_KEY_DEV

const headers = {
  Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  "Content-Type": "application/json",
}

// 🔹 Generate QR Code (with fallback to paylink)
export async function createXenditPayment(amount, name, mobile, telegramId) {
  const external_id = `kutabare-${Date.now()}`
  const payload = {
    external_id,
    amount,
    description: `Order for ${name} (${mobile})`,
    currency: "PHP",
    channel_code: "QRPH", // ✅ Ensure QRPH is selected
    callback_url: process.env.XENDIT_CALLBACK_URL || "https://tyangge24-7-1.onrender.com/webhook/xendit",
    type: "DYNAMIC",
  }

  try {
    const res = await axios.post("https://api.xendit.co/qr_codes", payload, { headers })

    // ✅ Send QR to user
    if (telegramId) {
      await bot.api.sendMessage(telegramId, `📲 Scan this QR using Maya or any QRPH app:`)
      await bot.api.sendPhoto(telegramId, res.data.qr_code)
    }

    return { type: "qr", url: res.data.qr_code, xenditInvoiceId: res.data.id }
  } catch (error) {
    console.error("❌ Failed to create QR. Falling back to paylink:", error.response?.data || error.message)
    const fallback = await createXenditPaylink(amount, name, mobile, telegramId)
    return fallback
  }
}

// 🔹 Fallback: Payment Link
async function createXenditPaylink(amount, name, mobile, telegramId) {
  const external_id = `kutabare-paylink-${Date.now()}`
  const payload = {
    external_id,
    payer_email: `${mobile}@noemail.com`,
    description: `Order for ${name} (${mobile})`,
    amount,
    currency: "PHP",
    success_redirect_url: process.env.XENDIT_SUCCESS_URL || "https://tyangge24-7-1.onrender.com/success",
    failure_redirect_url: process.env.XENDIT_FAILURE_URL || "https://tyangge24-7-1.onrender.com/failure",
  }

  const res = await axios.post("https://api.xendit.co/payment_links", payload, { headers })

  // ✅ Send Paylink to user
  if (telegramId) {
    await bot.api.sendMessage(telegramId, `💳 Click this to pay: ${res.data.invoice_url}`)
  }

  return {
    type: "paylink",
    url: res.data.invoice_url,
    xenditInvoiceId: res.data.id,
  }
}

// 🔔 Webhook Handler for Payment Confirmation
export async function handleXenditWebhook(req, res) {
  const event = req.body
  console.log("📩 Webhook Received:", event)

  try {
    if (event.status === "PAID") {
      const xenditInvoiceId = event.id

      const order = await Order.findOne({ xenditInvoiceId })

      if (!order) {
        return res.status(404).json({ error: "Order not found" })
      }

      // ✅ Update order payment status
      order.paymentStatus = "paid"
      order.status = "paid"
      order.updatedAt = new Date()
      await order.save()

      // ✅ Update payment transaction record
      await PaymentTransaction.findOneAndUpdate(
        { xenditInvoiceId },
        {
          status: "paid",
          paidAt: new Date(),
          webhookData: event,
        }
      )

      // ✅ Notify customer
      await bot.api.sendMessage(order.telegramId, `💸 *Payment received!* Your order is now *confirmed*. G na ta beh! 💕`, { parse_mode: "Markdown" })

      // ✅ Notify admin
      await bot.api.sendMessage(config.ADMIN_TELEGRAM_ID, `✅ *Payment received* for order #${order.orderNumber}\n👤 ${order.customerInfo.name}\n📱 ${order.customerInfo.contact}\n💰 ₱${order.total}`, { parse_mode: "Markdown" })

      // 🟡 Optional: Trigger timeline
      await bot.api.sendMessage(order.telegramId, `📦 Order status: *Preparing your items now!*`, { parse_mode: "Markdown" })

      return res.status(200).json({ success: true })
    }

    // If not "PAID"
    console.log("⚠️ Non-paid webhook event:", event.status)
    return res.status(200).json({ received: true })
  } catch (error) {
    console.error("❌ Error in webhook handler:", error)
    return res.status(500).json({ error: "Internal Server Error" })
  }
}
