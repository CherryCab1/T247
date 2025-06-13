import mongoose from "mongoose"
import { config } from "../config/env.js"

let isConnected = false

export async function connectDatabase() {
  if (isConnected) {
    console.log("📦 Using existing database connection")
    return
  }

  try {
    const options = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }

    await mongoose.connect(config.MONGO_URI, options)
    isConnected = true
    console.log("✅ Connected to MongoDB")

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      console.log("📦 MongoDB disconnected")
      isConnected = false
    })
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error)
    process.exit(1)
  }
}

export async function disconnectDatabase() {
  if (!isConnected) return

  try {
    await mongoose.disconnect()
    isConnected = false
    console.log("📦 Disconnected from MongoDB")
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error)
  }
}
