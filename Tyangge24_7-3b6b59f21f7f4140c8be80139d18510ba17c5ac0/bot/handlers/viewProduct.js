import { InlineKeyboard } from "grammy";
import { productData } from "../../data/products.js";

export async function viewProduct(ctx, productId) {
  let foundProduct = null;

  for (const category of Object.values(productData)) {
    for (const item of category.items) {
      if (item.id === productId) {
        foundProduct = item;
        break;
      }
    }
    if (foundProduct) break;
  }

  if (!foundProduct) {
    await ctx.answerCallbackQuery("Awts, indi makita ang item!");
    return;
  }

  const caption = `🛍️ <b>${foundProduct.name}</b>\n\n` +
    `${foundProduct.description || ""}\n\n` +
    `💸 <b>₱${foundProduct.price || "Varies"}</b>`;

  const keyboard = new InlineKeyboard()
    .text("➕ Add to Cart", `add_${foundProduct.id}`)
    .text("🔙 Back", `category_${foundProduct.category}`).row();

  const image = foundProduct.image || "https://via.placeholder.com/500x400?text=No+Image";

  try {
    await ctx.editMessageMedia({
      type: "photo",
      media: image,
      caption,
      parse_mode: "HTML"
    }, {
      reply_markup: keyboard
    });
  } catch (e) {
    await ctx.editMessageText(caption, {
      reply_markup: keyboard,
      parse_mode: "HTML"
    });
  }
}
