import { User, PendingApproval } from "../../models/index.js";
import { config } from "../../config/env.js";
import { showWelcomeMessage } from "./start.js";
import { InlineKeyboard } from "grammy";

export async function handleApproval(ctx) {
  if (ctx.from.id.toString() !== config.ADMIN_CHAT_ID) {
    await ctx.answerCallbackQuery("Hoy teh, indi ka authorized ha!");
    return;
  }

  const userId = Number(ctx.match[1]);

  try {
    const pendingApproval = await PendingApproval.findOne({ telegramId: userId });

    if (!pendingApproval) {
      await ctx.answerCallbackQuery("Wala ko kakita sang user, bes!");
      return;
    }

    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      await ctx.answerCallbackQuery("Wala ko ya user sa database, bes!");
      return;
    }

    await User.updateOne({ telegramId: userId }, { status: "approved" });

    await showEntranceAnimation(ctx.api, pendingApproval.chatId);

    await PendingApproval.deleteOne({ telegramId: userId });

    await ctx.editMessageText("✅ Approved na si accla! Welcome sa aton glam fam! 💅✨");
    await ctx.answerCallbackQuery("Bongga, approved na si accla!");
  } catch (error) {
    console.error("Error in handleApproval:", error);
    await ctx.answerCallbackQuery("Na-error kita teh, pasensya gid!");
  }
}

export async function handleDenial(ctx) {
  if (ctx.from.id.toString() !== config.ADMIN_CHAT_ID) {
    await ctx.answerCallbackQuery("Hoy teh, indi pwede ikaw!");
    return;
  }

  const userId = Number(ctx.match[1]);

  try {
    const pendingApproval = await PendingApproval.findOne({ telegramId: userId });

    if (!pendingApproval) {
      await ctx.answerCallbackQuery("Wala ko ya kakita sang user.");
      return;
    }

    await User.updateOne({ telegramId: userId }, { status: "denied" });

    await ctx.api.sendMessage(
      pendingApproval.chatId,
      "😔 Sorry gid besh, indi pwede subong. Balik lang liwat ha?\n\nBasi indi pa time mo, or wala ka pa sa tamang beki vibes! Char! 😂"
    );

    await PendingApproval.deleteOne({ telegramId: userId });

    await ctx.editMessageText("❌ Ginkastigo si accla. Na-inform na sya, don't worry.");
    await ctx.answerCallbackQuery("Denied na beshie!");
  } catch (error) {
    console.error("Error in handleDenial:", error);
    await ctx.answerCallbackQuery("Nagliki ang denial process, bes!");
  }
}

async function showEntranceAnimation(api, chatId) {
  const messages = [
    "🎉 WELCOME GID SA ATON GLAM WORLD! 🎉",
    "💅 Ginapreparar ang VIP treatment mo...",
    "✨ Loading beki powers... 100% na!",
    "🌈 Accla, parte ka na sang glam fam naton!",
  ];

  let msgId;
  for (let i = 0; i < messages.length; i++) {
    if (i === 0) {
      const msg = await api.sendMessage(chatId, messages[i]);
      msgId = msg.message_id;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await api.editMessageText(chatId, msgId, messages[i]);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  await showTermsAndConditions(api, chatId);
}

async function showTermsAndConditions(api, chatId) {
  const terms = `📜 *TYANGGE 24/7 TERMS & CHAKANESS*

Beshie, before ka mag-rampa kag magpa-checkout, make sure nabasa mo ni ha — para iwas chaka at gulo! 💅

✅ *DA RULES OF GLAMOUR:*
• 🔞 18+ lang — kung minor ka pa teh, balik ka next rebirth!
• 📦 Discreet na discreet ang packaging, swear!
• 🚫 No return, no exchange — hygiene yan teh!
• 💸 Pay before joy — bayad anay bago kalipay, ganern!
• 👑 Respetar sa staff, kay mga certified Reyna sila!

🚫 *Bawal na Kabobohan:*
• Chismisan ang mga binakal? Ayyy baka gusto mo ma-ban! 🤭
• Screenshot mo pa talaga? Sssst! Pang-self lang ‘to!
• Bastusan? Block agad yan, mare!
• Feeling libre? CHAROT ka bes, negosyo ini!

💳 *Bayad Modes:*
• GCash, Maya, Bank Transfer — walang palusot, teh!
• No COD-COD-an, sorry not sorry!
• Buo ang bayad para walay issue, diba?

🚚 *Delivery Realness:*
• May same-day kung bet mo na now na!
• Pwede pick-up kung gusto mo makita si Kuya Rider 🙈
• Doble lock, triple sealed — WALANG MAKAKAAMOY!

Teh, kung gets mo na ‘to — let’s go na sa next level! ✨`

  const keyboard = new InlineKeyboard()
    .text("✅ Agree (Push na 'to!)", "agree_terms")
    .text("❌ Disagree (Wait lang, mare)", "disagree_terms");

  await api.sendMessage(chatId, terms, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export async function handleTermsAgreement(ctx) {
  await ctx.editMessageText("✅ Boom! Bongga ka na besh, sunod na: *AGE VERIFICATION*. 🔞", { parse_mode: "Markdown" });
  await showAgeVerification(ctx.api, ctx.chat.id);
}

export async function handleTermsDisagreement(ctx) {
  await ctx.editMessageText("😔 Ay ambot teh, indi pa sya ready. Come back kung handa ka na maging fabulous! 💔");
}

export async function showAgeVerification(api, chatId) {
  const ageVerification = `🔞 *AGE VERIFICATION CHENELYN*

Beshie, bago kita papasukin sa beki dimension, kailangan lang namin ma-sure na *legal* ka na gid. 🤓

By saying you’re 18+:
• ✅ You confirm na of legal age ka — hindi bata-bata lang!
• ✅ You understand na mga kabuangan para sa matatapang lang ini!
• ✅ Kaya mo ang *Full Power Beki Energy* — walang iiyak ah!

So ano, game ka na?
18+ ka na gid bala, beh? Type tap lang below kung ready na ang beksiness mo! 💖`

  const keyboard = new InlineKeyboard()
    .text("✅ I'm 18+ (Go na go!)", "confirm_age")
    .text("❌ I'm under 18 (Back muna ako)", "under_age");

  await api.sendMessage(chatId, ageVerification, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export async function handleAgeConfirmation(ctx) {
  await User.updateOne({ telegramId: ctx.from.id }, { ageVerified: true });
  await ctx.editMessageText("✅ Yaasss! Confirmed ka na! Welcome sa fabulous squad naton! 🌈✨");
  await showWelcomeMessage(ctx);
}

export async function handleUnderAge(ctx) {
  await ctx.editMessageText("😔 Ay sad. Kung indi ka pa 18, balik lang kung legal na. Kami ya diri lang naga-hulat sa imo pagbalik, promise! 💖");
}
