import { InlineKeyboard } from "grammy"
import { User } from "../../models/index.js"
import { showWelcomeMessage } from "./start.js" // make sure path matches

export async function handleStart(ctx) {
  const userId = ctx.from.id
  const username = ctx.from.username || ctx.from.first_name

  try {
    let user = await User.findOne({ telegramId: userId })
    const HOURS = 24
    const expiresAfterMs = HOURS * 60 * 60 * 1000
    const isApprovedAndValid =
      user &&
      user.status === "approved" &&
      user.lastApprovedAt &&
      Date.now() - user.lastApprovedAt.getTime() < expiresAfterMs

    if (isApprovedAndValid) {
      return showWelcomeMessage(ctx)
    }

    // 🎭 Fun loading animation
    const loadingMsg = await ctx.reply(
      "🔮 Ginalantaw anay ang kapalaran mo, beshy... hang tight!"
    )
    await new Promise((r) => setTimeout(r, 2000))
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      "🧘‍♀️ Chill ka lang muna — assessing pa ang aura mo, mare."
    )
    await new Promise((r) => setTimeout(r, 1500))
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      "🍵 Ginaluto pa ang chika... lapit na gid!"
    )

    // ✏️ Save new user if none
    if (!user) {
      user = new User({
        telegramId: userId,
        username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        status: "draft",
        joinedAt: new Date(),
      })
      await user.save()
    }

    // 💬 Terms & Conditions + Age Confirmation
    const termsKeyboard = new InlineKeyboard().text(
      "✅ Oo, Agree na ako + 18 pataas!",
      "agree_terms"
    )

    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      "⚠️ *Terms & Kondisyon ni Mare* ⚠️\n\n" +
      "• 🔞 Bawal ang shungangels — 18+ only ha!\n" +
      "• ✨ By clicking Agree, swak ka sa all chika & policies dito.\n" +
      "• 💖 Treat everyone like queens — bawal bastos, okay?\n" +
      "• 🔐 Privacy is key, mare. Ang chismis mo safe sa amin!\n" +
      "• 💸 Once nag-order ka, di na pwede iurong — sureball ha!\n" +
      "• 🎁 Delivery discreet, walang makaamoy, pang-Kween lang!\n" +
      "• 📆 Approvals reset every 24 hrs — wag tamad!\n" +
      "• ⚡ *Indi pwede ang gadali*, besh — chill ka lang, let's take our time! 🐢\n" +
      "• 👑 Have fun, shop like a diva — at bawal ang pa-suplada! 💅\n\n" +
      "Kung swak sayo ni, beshie — click Agree sa baba! 💖",
      { reply_markup: termsKeyboard }
    )
  } catch (err) {
    console.error("⚠️ Error sa handleStart:", err)
    await ctx.reply(
      "Waaah! Nagsunggod ang sistema, mare. Subukan ulit mamaya ha! 💖"
    )
  }
}
