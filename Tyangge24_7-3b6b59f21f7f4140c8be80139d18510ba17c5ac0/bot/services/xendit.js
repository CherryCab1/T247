import axios from "axios";
import QRCode from "qrcode";
import { bot } from "../index.js";
import { config } from "../../config/env.js";

// ✅ Setup API Key
const env = process.env.XENDIT_ENV || "development";
const apiKey =
  env === "production"
    ? process.env.XENDIT_API_KEY_PROD
    : process.env.XENDIT_API_KEY_DEV;

const headers = {
  Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  "Content-Type": "application/json",
};

// ✅ Generate Invoice + Send QR
export async function createXenditInvoice(amount, name, mobile, telegramId) {
  const external_id = `kutabare-invoice-${Date.now()}`;
  const payload = {
    external_id,
    amount: Number(amount),
    currency: "PHP",
    description: `Order for ${name} (${mobile})`,
  };

  console.log("📦 Creating invoice with payload:", payload);

  try {
    const res = await axios.post("https://api.xendit.co/v2/invoices", payload, { headers });
    const invoice = res.data;

    const qrString = invoice.qr_checkout_string;
    const qrPhUrl = invoice.available_channels?.find(c => c.channel_code === "QRPH")?.payment_url;

    if (qrString) {
      const qrImageBuffer = await QRCode.toBuffer(qrString, {
        errorCorrectionLevel: "H",
        width: 300,
      });

      await bot.api.sendPhoto(telegramId, { source: qrImageBuffer }, {
        caption: `📲 Scan to pay using GCash, Maya, or any QR Ph-enabled app.\n💰 Amount: ₱${amount}\n🧾 Order ID: ${external_id}`,
      });

      return {
        type: "qr_code",
        qrString,
        xenditInvoiceId: invoice.id,
      };
    } else if (qrPhUrl) {
      await bot.api.sendMessage(telegramId, `📲 Click to pay via QR Ph:\n${qrPhUrl}`);
      return {
        type: "qrph_link",
        url: qrPhUrl,
        xenditInvoiceId: invoice.id,
      };
    } else {
      // Fallback to default invoice URL
      await bot.api.sendMessage(telegramId, `⚠️ QR not available.\nPay here:\n${invoice.invoice_url}`);
      return {
        type: "invoice_fallback",
        url: invoice.invoice_url,
        xenditInvoiceId: invoice.id,
      };
    }
  } catch (error) {
    console.error("❌ Error creating Xendit invoice:", error.response?.data || error.message);
    throw error;
  }
}
