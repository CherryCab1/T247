// ✅ FINAL REFACTORED start.js
import { InlineKeyboard } from "grammy";
import { User } from "../../models/index.js";
import { showTermsAndConditions } from "./approval.js";

export async function handleStart(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  try {
    let user = await User.findOne({ telegramId: userId });
    const HOURS = 24;
    const expiresAfterMs = HOURS * 60 * 60 * 1000;
    const isApprovedAndValid =
      user &&
      user.status === "approved" &&
      user.lastApprovedAt &&
      Date.now() - user.lastApprovedAt.getTime() < expiresAfterMs;

    if (isApprovedAndValid) {
      return showWelcomeMessage(ctx);
    }

    const loadingMsg = await ctx.reply(
      "🔮 Ginalantaw anay ang kapalaran mo, beshy... hang tight!"
    );
    await new Promise((r) => setTimeout(r, 2000));
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      "🧘‍♀️ Chill ka lang muna — assessing pa ang aura mo, mare."
    );
    await new Promise((r) => setTimeout(r, 1500));
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      "🍵 Ginaluto pa ang chika... lapit na gid!"
    );

    if (!user) {
      user = new User({
        telegramId: userId,
        username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        status: "draft",
        joinedAt: new Date(),
      });
      await user.save();
    }

    // 👇 Load the centralized Terms & Conditions from approval.js
    await showTermsAndConditions(ctx.api, ctx.chat.id);
  } catch (err) {
    console.error("⚠️ Error sa handleStart:", err);
    await ctx.reply(
      "Waaah! Nagsunggod ang sistema, mare. Subukan ulit mamaya ha! 💖"
    );
  }
}

export async function showWelcomeMessage(ctx) {
  const welcomeMsg = `🌈 *WELCAM WELCAM SA TYANGGE 24/7!* 🌈

Teh, ang tadhana gid naglapit sa imo diri! 💖

Diri lang sa among kaldereta makit-an ang:
🔥 *Totally Tuhog-tuhog Essentials*
💦 *Discreet delivery with matching whisper*
⚡ *Same-day chika, walang arte*
👑 *VIP customer service, pang-Kween lang!*

Ready ka na mag-shop, beshie? Dali na, click click na! 💅`;

  const keyboard = new InlineKeyboard()
    .text("🛍️ Shopping", "start_shopping")
    .row()
    .text("🛒 Cart", "view_cart")
    .row()
    .text("📦 Mga Orders Ko", "my_orders");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(welcomeMsg, { reply_markup: keyboard });
  } else {
    await ctx.reply(welcomeMsg, { reply_markup: keyboard });
  }
}
