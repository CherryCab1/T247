import dotenv from "dotenv";
dotenv.config();

// Environment configuration
export const config = {
  // Server
  PORT: process.env.PORT || 10000,
  NODE_ENV: process.env.NODE_ENV || "production",

  // Telegram
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,

  // Database
  MONGO_URI: process.env.MONGO_URI || process.env.MONGO_URL,

  // Webhook
  WEBHOOK_URL: process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL,
  WEBHOOK_PATH: "/webhook/telegram",

  // API
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || "admin123",

  // Payment
  XENDIT_API_KEY: process.env.XENDIT_API_KEY,
};

// Validate required environment variables
export function validateEnv() {
  const required = ["BOT_TOKEN", "MONGO_URI", "ADMIN_CHAT_ID"];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:", missing);
    process.exit(1);
  }

  console.log("✅ Environment variables validated");
}
