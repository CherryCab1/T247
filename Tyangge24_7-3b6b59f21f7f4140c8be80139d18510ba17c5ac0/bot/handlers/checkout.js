import { Keyboard } from "grammy";
import { User } from "../../models/index.js";
import { createXenditPayment } from "../services/xendit.js";

// Set your shop’s coordinates!
export const SHOP_LOCATION = { lat: 14.5995, lng: 120.9842 };

// Haversine formula for distance in km
export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

// Customize delivery fee formula as needed
export function calculateDeliveryFee(distanceKm) {
  const base = 50;
  const perKm = 10;
  return Math.round(base + perKm * distanceKm);
}

// Ilonggo-Beki order summary
export function getOrderSummary(cart, checkoutData, deliveryFee) {
  let summary = "🌈 <b>BEKS ORDER SUMMARY</b>\n";
  let total = 0;
  cart.forEach((item, idx) => {
    const itemName = item.variantName
      ? `${item.productName} (${item.variantName})`
      : item.productName;
    const subtotal = item.price * item.quantity;
    total += subtotal;
    summary += `${idx + 1}. ${itemName} — ₱${item.price} x ${item.quantity} = ₱${subtotal}\n`;
  });
  summary += `\n💅 Subtotal: ₱${total}`;
  summary += `\n🚚 Delivery Fee: ₱${deliveryFee}`;
  summary += `\n\n💎 <b>GRAND TOTAL:</b> ₱${total + deliveryFee}`;
  if (checkoutData) {
    summary += `\n\n👤 Pangalan: ${checkoutData.name || ""}\n📱 Number: ${checkoutData.mobile || ""}\n🏡 Location: ${checkoutData.addressNote || "📍 [Shared Location]"}`;
  }
  return summary;
}

// Reset checkout status sang beks
export async function clearCheckoutState(user) {
  user.checkoutStep = null;
  user.checkoutData = {};
  await user.save();
}

// Sugod checkout process
export async function handleCheckout(ctx) {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });
  const cart = user?.cart || [];

  if (!cart.length) {
    await ctx.answerCallbackQuery("Empty ang cart mo, day!");
    return;
  }

  user.checkoutStep = "awaiting_name";
  user.checkoutData = {};
  await user.save();

  await ctx.reply(
    "Gorlay! 📝 Anong full name mo bala para sa order?",
    { reply_markup: { remove_keyboard: true } }
  );
}

// Pangayo number gamit contact share
export async function askForMobile(ctx) {
  const keyboard = new Keyboard()
    .requestContact("📲 Share mo number mo, bakla!")
    .row()
    .text("⬅️ Balik");
  await ctx.reply(
    "📱 Pindota lang ang button, i-share mo number mo, day!",
    { reply_markup: keyboard }
  );
}

// Pangayo location gamit location share
export async function askForLocation(ctx) {
  const keyboard = new Keyboard()
    .requestLocation("📍 Share mo location mo, dai!")
    .row()
    .text("⬅️ Balik");
  await ctx.reply(
    "📍 Tap the button para mashare mo location mo, beshie!",
    { reply_markup: keyboard }
  );
}

// Main handler sa mga messages during checkout
export async function handleCheckoutMessage(ctx) {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });
  if (!user || !user.checkoutStep) return;

  // Step 1: Pangalan
  if (user.checkoutStep === "awaiting_name" && ctx.message.text) {
    const name = ctx.message.text.trim();
    if (name.length < 3) {
      await ctx.reply("Day, dapat at least 3 letra ang pangalan mo. Tarong ah!");
      return;
    }
    user.checkoutData.name = name;
    user.checkoutStep = "awaiting_mobile";
    await user.save();
    await askForMobile(ctx);
    return true;
  }

  // Step 2: Mobile
  if (user.checkoutStep === "awaiting_mobile") {
    if (ctx.message.contact && ctx.message.contact.phone_number) {
      user.checkoutData.mobile = ctx.message.contact.phone_number;
      user.checkoutStep = "awaiting_location";
      await user.save();
      await askForLocation(ctx);
      return true;
    }
    if (ctx.message.text === "⬅️ Balik") {
      user.checkoutStep = "awaiting_name";
      await user.save();
      await ctx.reply("Ulit bes, ano nga gani pangalan mo?");
      return true;
    }
    await ctx.reply("Pindota ang button para ma-share mo number mo, beh!");
    return true;
  }

  // Step 3: Location
  if (user.checkoutStep === "awaiting_location") {
    if (ctx.message.location) {
      user.checkoutData.location = ctx.message.location;
      user.checkoutStep = "awaiting_address_note";
      await user.save();
      await ctx.reply("May gusto ka pa i-add nga note para sa address mo? (e.g. 'Pink gate, tupad sang lugawan.') Type 'wala' kung deadma lang.");
      return true;
    }
    if (ctx.message.text === "⬅️ Balik") {
      user.checkoutStep = "awaiting_mobile";
      await user.save();
      await askForMobile(ctx);
      return true;
    }
    await ctx.reply("I-share mo location mo gamit ang button, dai!");
    return true;
  }

  // Step 4: Optional address note
  if (user.checkoutStep === "awaiting_address_note" && ctx.message.text) {
    user.checkoutData.addressNote = ctx.message.text.trim().toLowerCase() === "wala" ? "" : ctx.message.text.trim();
    user.checkoutStep = "confirming";
    await user.save();

    const userLoc = user.checkoutData.location;
    const distance = calculateDistanceKm(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      userLoc.latitude,
      userLoc.longitude
    );
    const deliveryFee = calculateDeliveryFee(distance);

    user.checkoutData.deliveryFee = deliveryFee;
    user.checkoutData.grandTotal = user.cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + deliveryFee;
    await user.save();

    const summary = getOrderSummary(user.cart, user.checkoutData, deliveryFee);
    await ctx.reply( `${summary}\n\nKon okay ka na, dai, pindota lang ang 'Confirmed, proceed to payment!'\n\nKung may mali or gusto mo balik, type /back lang ha!`,
  {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Confirmed, proceed to payment!", callback_data: "checkout_confirm" }]
      ]
    }
  }
);
    return true;
  }

  return false;
}

// Handler sang inline button para sa payment confirm
export async function handleCheckoutCallback(ctx) {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });

  if (!user || user.checkoutStep !== "confirming") return false;

  if (ctx.callbackQuery.data === "checkout_confirm") {
    const paymentLink = await createXenditPayment(
      user.checkoutData.grandTotal,
      user.checkoutData.name,
      user.checkoutData.mobile
    );
    const summary = getOrderSummary(user.cart, user.checkoutData, user.checkoutData.deliveryFee);

    await ctx.reply(
  `💸 <b>Payment Details</b>\n\n${summary}\n\nI-scan or i-click ang link para bayaran na ang order mo, dai!\n${paymentLink}\n\nAfter mo mabayaran, wait ka lang sa update sa delivery ha!`,
  { parse_mode: "HTML" }
);

    user.cart = [];
    user.checkoutStep = null;
    user.checkoutData = {};
    await user.save();

    await ctx.answerCallbackQuery();
    return true;
  }

  return false;
}
