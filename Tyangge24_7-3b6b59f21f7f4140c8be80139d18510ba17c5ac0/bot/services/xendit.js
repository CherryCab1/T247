// services/xendit.js
import axios from "axios";

const env = process.env.XENDIT_ENV || "development";
const apiKey =
  env === "production"
    ? process.env.XENDIT_API_KEY_PROD
    : process.env.XENDIT_API_KEY_DEV;

const headers = {
  Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  "Content-Type": "application/json",
};

// Generate QR code for payment
export async function createXenditPayment(amount, name, mobile) {
  try {
    const external_id = `kutabare-${Date.now()}`;
    const payload = {
      external_id,
      amount,
      description: `Order for ${name} (${mobile})`,
      currency: "PHP",
    };

    const res = await axios.post("https://api.xendit.co/qr_codes", payload, {
      headers,
    });

    return res.data.qr_code; // image URL
  } catch (error) {
    console.error("❌ Failed to create Xendit QR code:", error.response?.data || error.message);
    throw new Error("QR generation failed. Please try again.");
  }
}
