import axios from "axios";
import QRCode from "qrcode";
import { bot } from "../index.js";
import { config } from "../../config/env.js";

const env = process.env.XENDIT_ENV || "development";
const apiKey =
  env === "production"
    ? process.env.XENDIT_API_KEY_PROD
    : process.env.XENDIT_API_KEY_DEV;

const headers = {
  Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  "Content-Type": "application/json",
};

// ✅ Primary: Create QRPH QR Code
export async function createXenditQRPHQRCode(amount, orderNumber, telegramId) {
  const external_id = `qrph-${orderNumber}-${Date.now()}`;

  const payload = {
    external_id,
    type: "DYNAMIC",
    callback_url: `${config.DOMAIN}/webhook/xendit`,
    amount: Number(amount),
    currency: "PHP",
    payment_method: {
      channel_code: "QRPH",
    },
  };

  try {
    const res = await axios.post("https://api.xendit.co/qr_codes", payload, { headers });
    const qrData = res.data;

    const qrImageBuffer = await QRCode.toBuffer(qrData.qr_string, {
      errorCorrectionLevel: "H",
      width: 300,
    });

    await bot.api.sendPhoto(telegramId, { source: qrImageBuffer }, {
      caption: `📲 Scan this QR Code using GCash, Maya, or any QR Ph-enabled app.\n\n🧾 Order: #${orderNumber}\n💰 Amount: ₱${amount}`,
    });

    return {
      type: "qrph",
      qrId: qrData.id,
      xenditQRString: qrData.qr_string,
      status: qrData.status,
      expiresAt: qrData.expires_at,
    };
  } catch (error) {
    console.error("❌ Failed to create QRPH QR Code:", error.response?.data || error.message);
    throw error;
  }
}

// 🆕 Secondary: Create fallback browser invoice
export async function createXenditInvoice(amount, orderNumber, telegramId) {
  const payload = {
    external_id: `inv-${orderNumber}-${Date.now()}`,
    amount: Number(amount),
    description: `Invoice for Order #${orderNumber}`,
    currency: "PHP",
    success_redirect_url: `${config.DOMAIN}/thank-you`,
  };

  try {
    const res = await axios.post("https://api.xendit.co/v2/invoices", payload, { headers });
    const invoice = res.data;

    await bot.api.sendMessage(
      telegramId,
      `🔗 If you can’t scan QR, click to pay here:\n🧾 Order: #${orderNumber}\n💰 Amount: ₱${amount}\n💳 Payment Link: ${invoice.invoice_url}`
    );

    return {
      type: "invoice",
      invoiceId: invoice.id,
      url: invoice.invoice_url,
      status: invoice.status,
      expiresAt: invoice.expiry_date,
    };
  } catch (error) {
    console.error("❌ Failed to create Invoice:", error.response?.data || error.message);
    throw error;
  }
}

// 🌟 Smart wrapper: tries QRPH first, falls back to Invoice
export async function createXenditPayment(amount, orderNumber, telegramId) {
  try {
    return await createXenditQRPHQRCode(amount, orderNumber, telegramId);
  } catch (qrError) {
    console.warn("⚠️ Falling back to Invoice due to QRPH error...");
    return await createXenditInvoice(amount, orderNumber, telegramId);
  }
}
