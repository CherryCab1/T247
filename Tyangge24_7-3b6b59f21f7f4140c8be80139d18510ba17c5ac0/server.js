import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import { config, validateEnv } from "./config/env.js"
import { connectDatabase, disconnectDatabase } from "./database/connection.js"
import { bot, initializeBot } from "./bot/index.js"
import apiRoutes from "./api/routes.js"
import { webhookCallback } from "grammy"

validateEnv()

const app = express()

// 🛡️ Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
)
app.use(compression())

// 🌍 CORS
app.use(
  cors({
    origin: "*",
    credentials: false,
  })
)

// 📦 Body parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// 📡 API routes
app.use("/api", apiRoutes)

// 🤖 Telegram webhook
app.use(config.WEBHOOK_PATH, webhookCallback(bot, "express"))

// ❤️ Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: config.NODE_ENV,
  })
})

// 🌈 Status page
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tyangge 24/7 Bot</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 500px;
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          text-align: center;
        }
        h1 {
          color: #333;
          margin: 0 0 20px 0;
          font-size: 2.5em;
        }
        .status {
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 12px 24px;
          border-radius: 25px;
          font-weight: 600;
          margin: 20px 0;
          font-size: 1.1em;
        }
        .info {
          color: #666;
          margin: 15px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 0.9em;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌈 Tyangge 24/7</h1>
        <div class="status">✅ Active</div>
        <p class="info">Your fabulous Telegram bot is running! 💅</p>
        <p class="info">Ready to serve customers with style and fabulousness!</p>
        <div class="footer">
          <p>Server Time: ${new Date().toLocaleString()}</p>
          <p>Uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
          <p>Environment: ${config.NODE_ENV}</p>
        </div>
      </div>
    </body>
    </html>
  `)
})

// ❌ 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" })
})

// 🚨 Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err)
  res.status(500).json({
    error: config.NODE_ENV === "production" ? "Internal server error" : err.message,
  })
})

// 🧼 Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down like a queen...`)
  try {
    if (global.server) {
      global.server.close(() => {
        console.log("✅ HTTP server closed")
      })
    }
    await bot.stop()
    console.log("✅ Bot stopped")
    await disconnectDatabase()
    console.log("✅ Database disconnected")
    console.log("👑 Shutdown complete. Bye bye gurl!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error during shutdown:", error)
    process.exit(1)
  }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// 🚀 Start server
async function startServer() {
  try {
    console.log("🎉 Starting Tyangge 24/7 Server...")
    console.log(`🌱 Environment: ${config.NODE_ENV}`)
    console.log(`📦 Port: ${config.PORT}`)

    await connectDatabase()

    const botInitialized = await initializeBot()
    if (!botInitialized) throw new Error("Bot init failed")

    if (config.WEBHOOK_URL) {
      const webhookUrl = `${config.WEBHOOK_URL}${config.WEBHOOK_PATH}`
      await bot.api.deleteWebhook()
      console.log("🧹 Old webhook deleted")
      await bot.api.setWebhook(webhookUrl)
      console.log(`📡 New webhook set: ${webhookUrl}`)
    } else {
      console.log("⚠️ WEBHOOK_URL not set, bot might not receive updates!")
    }

    const server = app.listen(config.PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${config.PORT}`)
      console.log("💖 Tyangge 24/7 is LIVE and FABULOUS!")
    })
    global.server = server
  } catch (error) {
    console.error("❌ Startup failed:", error)
    process.exit(1)
  }
}
startServer()
