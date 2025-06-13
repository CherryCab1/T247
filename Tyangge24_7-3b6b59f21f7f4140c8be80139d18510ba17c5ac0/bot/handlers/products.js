import { InlineKeyboard } from "grammy";
import { productData } from "../../data/products.js";

// Show product list under a category
export async function showProducts(ctx, categoryKey) {
  const category = productData[categoryKey];

  if (!category || !category.items?.length) {
    await ctx.editMessageText("Aw bes, waay pa items diri subong ha! 😅");
    return;
  }

  const keyboard = new InlineKeyboard();
  let message = `🛍️ ${category.label.toUpperCase()}\n\nEto mga available naton subong, beshie! Pilia lang da! 💅\n\n`;
  let tempRow = [];

  category.items.forEach((product, index) => {
    const label = `${product.name} – ₱${product.price || "Varies"}`;
    const callbackData = `product_${product.id}`;
    if (label.length > 30) {
      keyboard.text(label, callbackData).row();
    } else {
      tempRow.push({ label, callbackData });
      if (tempRow.length === 2) {
        keyboard.text(tempRow[0].label, tempRow[0].callbackData)
                .text(tempRow[1].label, tempRow[1].callbackData)
                .row();
        tempRow = [];
      }
    }
    message += `${index + 1}. ${product.name} - ₱${product.price}\n`;
  });

  if (tempRow.length === 1) {
    keyboard.text(tempRow[0].label, tempRow[0].callbackData).row();
  }

  keyboard.text("🔙 Balik sa Categories", "start_shopping");

  await ctx.editMessageText(message, { reply_markup: keyboard });
}

// View product modal (with image and add-to-cart/back buttons)
export async function viewProduct(ctx, productId) {
  let product = null;
  let categoryKey = null;

  for (const [key, cat] of Object.entries(productData)) {
    const found = cat.items.find((p) => p.id === productId);
    if (found) {
      product = found;
      categoryKey = key;
      break;
    }
  }

  if (!product) {
    await ctx.answerCallbackQuery("Awts, indi ko makita ang item mo bes! 😅");
    return;
  }

  const caption = `🛍️ <b>${product.name}</b>\n\n` +
    `${product.description || "Wala description pero grabe ni siya promise!"}\n\n` +
    `💸 <b>₱${product.price || "Varies"}</b>`;

  const keyboard = new InlineKeyboard()
    .text("🛒 Ibutang sa Cart", `add_to_cart_${product.id}`)
    .text("🔙 Balik", `category_${categoryKey}`).row();

  const image = product.image || "https://via.placeholder.com/500x400?text=No+Image";

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
