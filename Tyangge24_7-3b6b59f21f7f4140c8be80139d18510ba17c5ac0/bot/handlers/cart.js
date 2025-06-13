import { InlineKeyboard } from "grammy";
import { User } from "../../models/index.js";
import { productData } from "../../data/products.js";
import { showCategories } from "./shopping.js";

// ✅ Add to Cart
export async function addToCart(ctx, productId, variantIndex = null) {
  const userId = ctx.from.id;

  try {
    let product = null;
    for (const category of Object.values(productData)) {
      const found = category.items.find((p) => p.id === productId);
      if (found) {
        product = found;
        break;
      }
    }

    if (!product) {
      await ctx.answerCallbackQuery("Waay ko na-found ang item, bes!");
      return;
    }

    const user = await User.findOne({ telegramId: userId }) || new User({ telegramId: userId, cart: [] });

    const cartItem = {
      productId,
      productName: product.name,
      variantIndex,
      variantName: variantIndex !== null ? product.variants[variantIndex].name : null,
      price: variantIndex !== null ? product.variants[variantIndex].price : product.price,
      quantity: 1,
      addedAt: new Date(),
    };

    user.cart.push(cartItem);
    await user.save();

    const itemName = cartItem.variantName
      ? `${product.name} (${cartItem.variantName})`
      : product.name;

    await ctx.answerCallbackQuery(`✅ Gindugang ta na ang '${itemName}' sa cart mo, gurl!`);

    const keyboard = new InlineKeyboard()
      .text("🛒 Tan-aw Cart", "view_cart")
      .text("➕ Dugang Pa", "start_shopping")
      .text("💳 Checkout Na!", "checkout");

    await ctx.editMessageText(
      `✅ NADUGANG NA SA CART! 🛒\n\n${itemName}\n💰 ₱${cartItem.price}\n\nAno next move mo, besh?`,
      { reply_markup: keyboard },
    );
  } catch (error) {
    console.error("Error adding to cart:", error);
    await ctx.answerCallbackQuery("Ay bes, error sa pagdugang! 😭");
  }
}

// 🛍️ Show Cart
export async function showCart(ctx) {
  const userId = ctx.from.id;

  try {
    const user = await User.findOne({ telegramId: userId });

    if (!user?.cart || user.cart.length === 0) {
      const keyboard = new InlineKeyboard()
        .text("🛍️ Shopping Ta Na!", "start_shopping")
        .text("🔙 Balik Menu", "back_to_menu");

      await ctx.editMessageText(
        "🛒 WALAY LAMAN ANG CART MO\n\nBes, indi pwede empty ang cart ha! Time to shop-shoop! 💅",
        { reply_markup: keyboard }
      );
      return;
    }

    let message = "🛒 ANG CART MO NGA PASABOG\n\n";
    let total = 0;

    user.cart.forEach((item, index) => {
      const itemName = item.variantName
        ? `${item.productName} (${item.variantName})`
        : item.productName;
      const subtotal = item.price * item.quantity;
      message += `${index + 1}. ${itemName}\n   💰 ₱${item.price} x ${item.quantity}\n   💵 Subtotal: ₱${subtotal}\n\n`;
      total += subtotal;
    });

    message += `💎 TOTAL NA BES: ₱${total}\n\nReady ka na mag-checkout, or dugang pa? 😉`;

    const keyboard = new InlineKeyboard()
      .text("💳 Checkout Na Dayon!", "checkout")
      .text("➕ Dugang pa Item", "start_shopping")
      .text("🗑️ Clear ang Cart", "clear_cart")
      .text("🔙 Balik Menu", "back_to_menu");

    await ctx.editMessageText(message, { reply_markup: keyboard });
  } catch (error) {
    console.error("Error showing cart:", error);
    await ctx.reply("Ay teh, indi makita cart mo subong! Wait lang ha.");
  }
}

// 🔄 Add More / Continue Shopping
export async function handleAddMore(ctx) {
  try {
    await ctx.answerCallbackQuery("G! Pili pa kita bes, damo pa ya! 💅");
    await showCategories(ctx);
  } catch (error) {
    console.error("Error in handleAddMore:", error);
    await ctx.reply("Ay teh, nagka-error kita. Wait lang anay ha! 😅");
  }
}
