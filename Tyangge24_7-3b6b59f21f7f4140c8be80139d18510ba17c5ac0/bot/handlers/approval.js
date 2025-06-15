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
  const terms = `📋 TYANGGE 24/7 TERMS & CHAROTDITIONS

Beshie, before ka mag-shopping2x dira, basaha anay ni ha! 💅

✅ MGA RULES NATON:
• 18+ lang pwede diri (minor de edad? out ka teh!)
• Super discreet packaging - promise!
• Wala return ha, hygiene-hygiene gid ni!
• Bayad anay before delivery, char!
• Respeto sa mga staff - mga Reyna ina sila!

🚫 INDI PWEDENG:
• I-chika ang mga produkto sa iba (secret lang naton ni!)
• Mag screenshot-screenshot ha!
• Mag bastos sa staff (hoy, bawal!)
• Magpalibre libre - indi ini charity bes!

💰 PAYMENT:
• GCash, PayMaya, Bank Transfer
• No COD-cod-an ha!
• Full bayad lang, para smooth!

🚚 DELIVERY:
• May same-day delivery!
• Pwede pick-up!
• Discreet, as always!

Okay ka na sini, beshie? Chika mo na!`;

  const keyboard = new InlineKeyboard()
    .text("✅ Agree (Sige na nga!)", "agree_terms")
    .text("❌ Disagree (Hindi ako ready)", "disagree_terms");

  await api.sendMessage(chatId, terms, { reply_markup: keyboard });
}

export async function handleTermsAgreement(ctx) {
  await ctx.editMessageText("✅ Ay sus, salamat gid besh! Sunod na ni, age verification ta... 🔞");
  await showAgeVerification(ctx.api, ctx.chat.id);
}

export async function handleTermsDisagreement(ctx) {
  await ctx.editMessageText("😔 Ay ambot bes, indi pa gid sya ready. Balik lang kung sure ka na gid ha! 💔");
}

export async function showAgeVerification(api, chatId) {
  const ageVerification = `🔞 AGE VERIFICATION GANI...

Beshie, kailangan lang namon i-make sure na 18+ ka na gid ha!

Ari sa aton tindahan, mga kabuangan for adults lang ni. By saying "I'm 18+", ginapakilala mo nga:
• Legal age ka na gid, promise!
• Gets mo gid kung ano ni nga items
• Kaya mo ang aton *Fabulous Energy*! 💅

18+ ka na gid bala, besh?`;

  const keyboard = new InlineKeyboard()
    .text("✅ I'm 18+ (Oo naman!)", "confirm_age")
    .text("❌ I'm under 18 (Hindi pa ako ready)", "under_age");

  await api.sendMessage(chatId, ageVerification, { reply_markup: keyboard });
}

export async function handleAgeConfirmation(ctx) {
  await User.updateOne({ telegramId: ctx.from.id }, { ageVerified: true });
  await ctx.editMessageText("✅ Yaasss! Confirmed ka na! Welcome sa fabulous squad naton! 🌈✨");
  await showWelcomeMessage(ctx);
}

export async function handleUnderAge(ctx) {
  await ctx.editMessageText("😔 Sorry beshie ha, balik lang kung legal age ka na. Diri lang kami ya naga-hulat! 💖");
}
