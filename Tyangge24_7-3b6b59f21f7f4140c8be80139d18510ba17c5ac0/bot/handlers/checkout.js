import { Keyboard } from "grammy";
import { User, PendingOrderApproval } from "../../models/index.js";
import { notifyAdmin } from "./notifyAdmin.js";
import { reverseGeocode } from "../services/geocode.js";
import { bot } from "../index.js"; // Import the bot instance
import { generateOrderNumber } from "../utils/generateOrderNumber.js";

export const SHOP_LOCATION = { lat: 14.5995, lng: 120.9842 };
export const loadingLoops = new Map();

export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export function calculateDeliveryFee(distanceKm) {
  const base = 50;
  const perKm = 10;
  return Math.round(base + perKm * distanceKm);
}

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
    summary += `\n\n👤 Pangalan: ${checkoutData.name || ""}`;
    summary += `\n📱 Number: ${checkoutData.mobile || ""}`;
    summary += `\n🏡 Address: ${checkoutData.resolvedAddress || "📍 [Location shared lang]"} ${
      checkoutData.addressNote ? `\n📝 Note: ${checkoutData.addressNote}` : ""
    }`;
  }
  return summary;
}

export async function clearCheckoutState(user) {
  user.checkoutStep = null;
  user.checkoutData = {};
  user.cart = [];
  await user.save();
}

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

  await ctx.reply("Gorlay! 📝 Anong full name mo bala para sa order?", {
    reply_markup: { remove_keyboard: true },
  });
}

export async function askForMobile(ctx) {
  const keyboard = new Keyboard()
    .requestContact("📲 Share mo number mo, bakla!")
    .row()
    .text("⬅️ Balik");
  await ctx.reply("📱 Pindota lang ang button, i-share mo number mo, day!", {
    reply_markup: keyboard,
  });
}

export async function askForLocation(ctx) {
  const keyboard = new Keyboard()
    .requestLocation("📍 Share mo location mo, dai!")
    .row()
    .text("⬅️ Balik");
  await ctx.reply("📍 Tap the button para mashare mo location mo, beshie!", {
    reply_markup: keyboard,
  });
}

export async function handleCheckoutMessage(ctx) {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });
  if (!user || !user.checkoutStep) return;

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

  if (user.checkoutStep === "awaiting_location") {
    if (ctx.message.location) {
      user.checkoutData.location = ctx.message.location;
      user.checkoutStep = "awaiting_address_note";
      await user.save();
      await ctx.reply("May note ka pa para sa address? Type 'wala' kung deadma lang.");
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

  if (user.checkoutStep === "awaiting_address_note" && ctx.message.text) {
    const note = ctx.message.text.trim().toLowerCase() === "wala" ? "" : ctx.message.text.trim();
    user.checkoutData.addressNote = note;
    user.checkoutStep = "confirming";

    const loc = user.checkoutData.location;
    const distance = calculateDistanceKm(SHOP_LOCATION.lat, SHOP_LOCATION.lng, loc.latitude, loc.longitude);
    const fee = calculateDeliveryFee(distance);

    const resolved = await reverseGeocode(loc.latitude, loc.longitude);
    user.checkoutData.resolvedAddress = resolved || "📍 Unknown address";
    user.checkoutData.deliveryFee = fee;
    user.checkoutData.grandTotal =
      user.cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + fee;

    await user.save();

    const summary = getOrderSummary(user.cart, user.checkoutData, fee);
    await ctx.reply(
      `${summary}\n\n✅ Kung bet mo na ini, tap mo lang ang ‘Confirmed, proceed to payment!’ button.\n❌ Kung may mali, just type /back para makabalik ka sa step.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "✅ Confirmed, proceed to payment!", callback_data: "checkout_confirm" }]],
        },
      }
    );
    return true;
  }

  return false;
}

export async function handleCheckoutCallback(ctx) {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });
  if (!user || user.checkoutStep !== "confirming") return false;

  if (ctx.callbackQuery.data === "checkout_confirm") {
    const loadingMsgs = [
      "⏳ Ginaluto pa beks...",
      "👩‍🍳 Ginalaga na sa init sang chismis...",
      "📡 Ginatawag na si admin para mag desisyon!",
    ];
    const loadingMsg = await ctx.reply(loadingMsgs[0]);
    let i = 0;
    const loop = setInterval(async () => {
      i = (i + 1) % loadingMsgs.length;
      try {
        await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, loadingMsgs[i]);
      } catch {
        clearInterval(loop);
        loadingLoops.delete(userId);
      }
    }, 2000);
    loadingLoops.set(userId, loop);

    user.checkoutStep = "awaiting_admin_approval";
    await user.save();

    const orderData = {
      telegramId: user.telegramId,
      username: ctx.from.username,
      orderNumber: generateOrderNumber(),
      items: user.cart,
      customerInfo: {
        name: user.checkoutData.name,
        deliveryMethod: "Delivery",
        contact: user.checkoutData.mobile,
        location: {
          latitude: user.checkoutData.location.latitude,
          longitude: user.checkoutData.location.longitude,
          resolvedAddress: user.checkoutData.resolvedAddress,
        },
        addressNote: user.checkoutData.addressNote || "",
      },
      subtotal: user.cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      deliveryFee: user.checkoutData.deliveryFee,
      total: user.checkoutData.grandTotal,
      status: "pending_approval",
      paymentStatus: "pending",
    };

    // Save only to PendingOrderApproval collection
    const pending = new PendingOrderApproval(orderData);
    await pending.save();

    await clearCheckoutState(user);
    await notifyAdmin(bot, pending);
    await ctx.answerCallbackQuery();
    return true;
  }

  return false;
}
