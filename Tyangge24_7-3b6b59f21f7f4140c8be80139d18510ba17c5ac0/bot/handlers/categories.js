import { InlineKeyboard } from "grammy";
import { productData } from "../../data/products.js";

export async function showCategories(ctx) {
  const text = `🛍️ <b>PILI-PILI NA, BES!</b>

Ano'ng gina-tripan mo subong? Pili lang sa mga kategoriya — tanan ya pangpabakal kag pangpakilig! 😘`;

  const keyboard = new InlineKeyboard();

  for (const [key, data] of Object.entries(productData)) {
    keyboard.text(data.emoji + " " + data.label, `category_${key}`).row();
  }

  keyboard.text("🔙 Balik Menu", "back_to_menu");

  await ctx.editMessageText(text, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
}
