import { InlineKeyboard } from "grammy"
import { User, PendingApproval } from "../../models/index.js"
import { config } from "../../config/env.js"

// 💄 GORA SA /start
export async function handleStart(ctx) {
  const userId = ctx.from.id
  const username = ctx.from.username || ctx.from.first_name

  try {
    let user = await User.findOne({ telegramId: userId })

    // ✅ Approved na si Inday
    if (user && user.status === "approved") {
      await showWelcomeMessage(ctx)
      return
    }

    // ⏳ Pending pa — i-allow siya mag resend sang request
    if (user && user.status === "pending") {
      const resendKeyboard = new InlineKeyboard().text("📤 Resend Request", "resend_request")
      await ctx.reply(
        `Hala mare, pending ka pa ya! 🕵️‍♀️
Ang mga reyna, busy pa sa husga kung pasok ka sa *Kween-dom*! 👑

Pero kung feeling mo gin-limtan ka na, click mo lang ini para magpa-remind ulit sa mga *judges*:`,
        { reply_markup: resendKeyboard }
      )
      return
    }

    // 🧙‍♀️ Entrance Animation
    const loadingMsg = await ctx.reply("🔮 Ginalantaw anay kung qualified ka sa beki realm, huwag ka praning!")
    await new Promise(r => setTimeout(r, 2000))
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, "🧘‍♀️ Ina-assess kung strong ang aura mo, mare... sagad ka gid man!")
    await new Promise(r => setTimeout(r, 1500))
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, "🍵 Ginaluto na ang chika... medyo may sabaw na, teh!")

    // 📝 Save Pending Approval
    await PendingApproval.findOneAndUpdate(
      { telegramId: userId },
      {
        telegramId: userId,
        username: username,
        chatId: ctx.chat.id,
        requestedAt: new Date(),
      },
      { upsert: true }
    )

    // 💾 First time mare, save as pending
    if (!user) {
      user = new User({
        telegramId: userId,
        username: username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        status: "pending",
        joinedAt: new Date(),
        lastRequestTime: new Date()
      })
      await user.save()
    }

    // 📣 Padalhan si admin sang pang-chika
    const adminKeyboard = new InlineKeyboard()
      .text("✅ I-Approve Gurl", `approve_${userId}`)
      .text("❌ Deadmahin", `deny_${userId}`)

    await ctx.api.sendMessage(
      config.ADMIN_CHAT_ID,
      `📢 *NEW ENTRY SA BEKI HOUSE!*\n\n` +
      `👤 Username: @${username}\n` +
      `🆔 ID: ${userId}\n` +
      `🕰️ Oras: ${new Date().toLocaleString()}\n\n` +
      `Admin gurl, approvehan ta ni o i-deadma lang ni sheshe?`,
      { reply_markup: adminKeyboard }
    )

    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      "📝 Application mo na-submit na mare! Abang-abang lang kay ginachika ka na sang mga diyosa sa admin panel! 👑\n\n" +
      "Pagdasal mo na lang may paglaum pa! ✨"
    )
  } catch (err) {
    console.error("⚠️ Error sa handleStart:", err)
    await ctx.reply("Waaah! Nagsunggod ang sistema, mare! Try ka liwat ha, kay basin ginkulam!")
  }
}

// 🔁 Callback for resend
export function registerResendRequest(bot) {
  bot.callbackQuery("resend_request", async (ctx) => {
    const userId = ctx.from.id
    const username = ctx.from.username || ctx.from.first_name

    const user = await User.findOne({ telegramId: userId })
    if (!user || user.status !== "pending") return ctx.answerCallbackQuery()

    const now = new Date()
    const last = user.lastRequestTime || new Date(0)
    const diff = (now - last) / 1000 / 60 // mins

    const cooldown = 4
    if (diff < cooldown) {
      return ctx.answerCallbackQuery({
        text: `⏱️ Gurl, kalma! Pwede ka mag resend after ${Math.ceil(cooldown - diff)} mins pa ha!`,
        show_alert: true
      })
    }

    user.lastRequestTime = now
    await user.save()

    await ctx.api.sendMessage(
      config.ADMIN_CHAT_ID,
      `🔁 *Gusto niya ulit pumasok, mare!*\n\n` +
      `👤 Username: @${username}\n` +
      `🆔 ID: ${userId}\n` +
      `📅 Oras: ${new Date().toLocaleString()}\n\n` +
      `Gina-resend niya ang request niya — pabati daw ulit, admin! 🙏`
    )

    await ctx.editMessageText("📨 Request mo na-resend na, beshie! Kung di pa rin napansin, baka kailangan mo na magsayaw sa ulan. ☔")
  })
}

// 🎉 Once approved
export async function showWelcomeMessage(ctx) {
  const welcomeMsg = `🌈 *WELCAM WELCAM SA TYANGGE 24/7!* 🌈

Teh, ang tadhana gid naglapit sa imo diri! 💖

Diri lang sa among kaldereta makit-an ang:
🔥 **Totally Tuhog-tuhog Essentials**
💦 **Discreet delivery with matching whisper**
⚡ **Same-day chika, walang arte**
👑 **VIP customer service, pang-Kween lang**

Ready ka na mag-shop, bes? Dali na, click click na! 💅`

  const keyboard = new InlineKeyboard()
    .text("🛍️ Shopping", "start_shopping").row()
    .text("🛒 Cart", "view_cart").row()
    .text("📦 Mga Orders Ko", "my_orders").row()
    .text("👑 Staff Lang Ni Diri", "staff_section")

  if (ctx.callbackQuery) {
    await ctx.editMessageText(welcomeMsg, { reply_markup: keyboard })
  } else {
    await ctx.reply(welcomeMsg, { reply_markup: keyboard })
  }
}
