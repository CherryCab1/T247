import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import { config, validateEnv } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import apiRoutes from "./api/routes.js";
import { webhookCallback } from "grammy";
import { bot, initializeBot } from "./bot/index.js";
import webhookRoutes from "./routes/webhook.js"; // <-- Use routes/webhook.js as discussed

dotenv.config();
validateEnv();

const app = express();

// Security
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes
app.use("/api", apiRoutes);

// Telegram webhook (if using grammY webhooks)
app.use(config.WEBHOOK_PATH, webhookCallback(bot, "express"));

// Xendit payment webhook -- must be before 404!
app.use("/webhook", webhookRoutes); // Mounts /webhook/xendit

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: config.NODE_ENV,
  });
});

// Status page
app.get("/", (req, res) => {
  res.send(`<h1>Tyangge 24/7 is running!</h1>`);
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: config.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down...`);
  try {
    if (global.server) {
      global.server.close(() => {
        console.log("✅ HTTP server closed");
      });
    }
    await bot.stop();
    console.log("✅ Bot stopped");
    await disconnectDatabase();
    console.log("✅ Database disconnected");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
async function startServer() {
  try {
    console.log("🎉 Starting Tyangge 24/7 Server...");
    await connectDatabase();

    const botInitialized = await initializeBot();
    if (!botInitialized) throw new Error("Bot init failed");

    if (config.WEBHOOK_URL) {
      const webhookUrl = `${config.WEBHOOK_URL}${config.WEBHOOK_PATH}`;
      await bot.api.deleteWebhook();
      console.log("🧹 Old webhook deleted");
      await bot.api.setWebhook(webhookUrl);
      console.log(`📡 New webhook set: ${webhookUrl}`);
    } else {
      console.log("⚠️ WEBHOOK_URL not set, bot might not receive updates!");
    }

    const server = app.listen(config.PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${config.PORT}`);
      console.log("💖 Tyangge 24/7 is LIVE and FABULOUS!");
    });
    global.server = server;
  } catch (error) {
    console.error("❌ Startup failed:", error);
    process.exit(1);
  }
}
startServer();
