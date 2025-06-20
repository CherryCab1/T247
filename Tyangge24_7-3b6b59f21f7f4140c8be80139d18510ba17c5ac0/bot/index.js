import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "../config/env.js";
import { logInteraction } from "./middleware/auth.js"; // Keep log if you still want interaction logging
import { handleStart } from "./handlers/start.js";
import { handleTermsAgreement, handleTermsDisagreement, handleAgeConfirmation, handleUnderAge } from "./handlers/approval.js";
import { showCategories } from "./handlers/categories.js";
import { showProducts, viewProduct as showProductDetails } from "./handlers/products.js";
import { addToCart, showCart, handleAddMore } from "./handlers/cart.js";
import * as checkout from "./handlers/checkout.js";
import { User } from "../models/index.js";

// 🚀 Create bot
export const bot = new Bot(config.BOT_TOKEN);

// 🌈 Global logger
bot.use(logInteraction);

// 💌 Entry
bot.command("start", handleStart);

// ✅ TERMS & AGE confirmation routes
bot.callbackQuery("agree_terms", handleTermsAgreement);
bot.callbackQuery("disagree_terms", handleTermsDisagreement);
bot.callbackQuery("confirm_age", handleAgeConfirmation);
bot.callbackQuery("under_age", handleUnderAge);

// 🧂 Categories
bot.callbackQuery("category_rings", (ctx) => showProducts(ctx, "rings"));
bot.callbackQuery("category_lubes", (ctx) => showProducts(ctx, "lubes"));
bot.callbackQuery("category_enhancers", (ctx) => showProducts(ctx, "enhancers"));
bot.callbackQuery("category_accessories", (ctx) => showProducts(ctx, "accessories"));
bot.callbackQuery("category_essentials", (ctx) => showProducts(ctx, "essentials"));
bot.callbackQuery("start_shopping", showCategories);
bot.callbackQuery("back_to_menu", handleStart); // Return to main menu if needed

// 🛍 Products
bot.callbackQuery(/product_(.+)/, (ctx) => {
  const productId = ctx.match[1];
  return showProductDetails(ctx, productId);
});

// 🧺 Cart
bot.callbackQuery(/variant_(.+)_(\d+)/, (ctx) => {
  const productId = ctx.match[1];
  const variantIndex = Number.parseInt(ctx.match[2]);
  return addToCart(ctx, productId, variantIndex);
});
bot.callbackQuery(/add_to_cart_(.+)/, (ctx) => {
  const productId = ctx.match[1];
  return addToCart(ctx, productId);
});
bot.callbackQuery("view_cart", showCart);
bot.callbackQuery("clear_cart", async (ctx) => {
  const userId = ctx.from.id;
  await User.updateOne({ telegramId: userId }, { cart: [] });
  await ctx.answerCallbackQuery("🧺 Cart cleared!");
  await showCart(ctx);
});
bot.callbackQuery("add_more", handleAddMore);

// 💸 Checkout
bot.command("checkout", checkout.handleCheckout);
bot.callbackQuery("checkout", checkout.handleCheckout);

// 💬 Checkout messages & callback handling
bot.on("message", async (ctx) => {
  const handled = await checkout.handleCheckoutMessage(ctx);
  if (handled) return;
});
bot.on("callback_query:data", async (ctx) => {
  const handled = await checkout.handleCheckoutCallback(ctx);
  if (handled) return;
});

// 🧯 Error handling
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`💀 Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("💔 Telegram API error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("🌐 HTTP error:", e);
  } else {
    console.error("🤷‍♀️ Unknown error:", e);
  }
});

// 🚀 Start bot
export async function initializeBot() {
  try {
    await bot.init();
    console.log("🤖 Bot initialized successfully!");
    const me = await bot.api.getMe();
    console.log(`👑 Connected as: @${me.username}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to init bot:", error);
    return false;
  }
}
