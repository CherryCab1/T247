import { Bot, GrammyError, HttpError } from "grammy"
import { config } from "../config/env.js"
import { logInteraction, checkUserApproval } from "./middleware/auth.js"
import { handleStart } from "./handlers/start.js"
import {
  handleApproval,
  handleDenial,
  handleTermsAgreement,
  handleTermsDisagreement,
  handleAgeConfirmation,
  handleUnderAge,
} from "./handlers/approval.js"

import { showCategories } from "./handlers/categories.js"
import { showProducts, viewProduct as showProductDetails } from "./handlers/products.js"
import { addToCart, showCart, handleAddMore } from "./handlers/cart.js"
import * as checkout from "./handlers/checkout.js"
import { User } from "../models/index.js"
import { PendingOrderApproval } from "../models/index.js";
import { setupAdminCallbacks } from "./handlers/notifyAdmin.js"


// 👑 Bot instance
export const bot = new Bot(config.BOT_TOKEN)

// 🌈 Global middleware
bot.use(logInteraction)

// 💌 Commands
bot.command("start", handleStart)
bot.command("checkout", checkout.handleCheckout)

// ✅ Approval Flow
bot.callbackQuery(/approve_(\d+)/, handleApproval)
bot.callbackQuery(/deny_(\d+)/, handleDenial)
bot.callbackQuery("agree_terms", handleTermsAgreement)
bot.callbackQuery("disagree_terms", handleTermsDisagreement)
bot.callbackQuery("confirm_age", handleAgeConfirmation)
bot.callbackQuery("under_age", handleUnderAge)

// 🛍️ Shopping Flow
bot.callbackQuery("start_shopping", checkUserApproval, showCategories)
bot.callbackQuery("back_to_menu", checkUserApproval, handleStart)

// 🧂 Categories
bot.callbackQuery("category_rings", checkUserApproval, (ctx) => showProducts(ctx, "rings"))
bot.callbackQuery("category_lubes", checkUserApproval, (ctx) => showProducts(ctx, "lubes"))
bot.callbackQuery("category_enhancers", checkUserApproval, (ctx) => showProducts(ctx, "enhancers"))
bot.callbackQuery("category_accessories", checkUserApproval, (ctx) => showProducts(ctx, "accessories"))
bot.callbackQuery("category_essentials", checkUserApproval, (ctx) => showProducts(ctx, "essentials"))

// 🛍 Product Details
bot.callbackQuery(/product_(.+)/, checkUserApproval, (ctx) => {
  const productId = ctx.match[1]
  return showProductDetails(ctx, productId)
})

// 🛒 Cart Actions
bot.callbackQuery(/variant_(.+)_(\d+)/, checkUserApproval, (ctx) => {
  const productId = ctx.match[1]
  const variantIndex = Number.parseInt(ctx.match[2])
  return addToCart(ctx, productId, variantIndex)
})
bot.callbackQuery(/add_to_cart_(.+)/, checkUserApproval, (ctx) => {
  const productId = ctx.match[1]
  return addToCart(ctx, productId)
})

bot.callbackQuery("view_cart", checkUserApproval, showCart)
bot.callbackQuery("clear_cart", checkUserApproval, async (ctx) => {
  const userId = ctx.from.id
  await User.updateOne({ telegramId: userId }, { cart: [] })
  await ctx.answerCallbackQuery("🧺 Cart cleared! Luwag na utang!")
  await showCart(ctx)
})

bot.callbackQuery("add_more", checkUserApproval, handleAddMore)
bot.callbackQuery("checkout", checkUserApproval, checkout.handleCheckout)

// 📩 Checkout messages & callbacks
bot.on("message", async (ctx) => {
  const handled = await checkout.handleCheckoutMessage(ctx)
  if (handled) return
})

bot.on("callback_query:data", async (ctx) => {
  const handled = await checkout.handleCheckoutCallback(ctx)
  if (handled) return
})

setupAdminCallbacks(bot)

// 🧯 Error handling
bot.catch((err) => {
  const ctx = err.ctx
  console.error(`💀 Error while handling update ${ctx.update.update_id}:`)
  const e = err.error
  if (e instanceof GrammyError) {
    console.error("💔 Telegram API error:", e.description)
  } else if (e instanceof HttpError) {
    console.error("🌐 HTTP error:", e)
  } else {
    console.error("🤷‍♀️ Unknown error:", e)
  }
})

// 🚀 Bot launcher
export async function initializeBot() {
  try {
    await bot.init()
    console.log("🤖 Bot initialized na mga dayyy!")
    const me = await bot.api.getMe()
    console.log(`👑 Connected as: @${me.username} — certified kikay!`)
    return true
  } catch (error) {
    console.error("❌ Failed to initialize bot, shuta ka Gurl:", error)
    return false
  }
}
