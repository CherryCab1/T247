import { InlineKeyboard } from "grammy"
import { User } from "../../models/index.js"
import { productData } from "../../data/products.js"

// Show Categories
export async function showCategories(ctx) {
  const text = `🛍️ <b>PILI-PILI NA, BES!</b>

Ano'ng gina-tripan mo subong? Pili lang sa mga kategoriya — tanan ya pangpabakal kag pangpakilig! 😘`

  const keyboard = new InlineKeyboard()

  for (const [categoryKey, categoryData] of Object.entries(productData)) {
    keyboard.text(categoryData.emoji + " " + categoryData.label, `category_${categoryKey}`).row()
  }

  keyboard.text("🔙 Balik Menu", "back_to_menu")

  await ctx.editMessageText(text, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  })
}

// Show Products in a Category
export async function showProducts(ctx, categoryKey) {
  const category = productData[categoryKey]

  if (!category || !category.items || category.items.length === 0) {
    await ctx.editMessageText("Aw bes, waay pa items diri subong ha! 😅")
    return
  }

  let message = `🛍️ ${category.label.toUpperCase()}\n\nEto mga available naton subong, beshie! Pilia lang da! 💅\n\n`

  const keyboard = new InlineKeyboard()
  let tempRow = []

  category.items.forEach((product, index) => {
    message += `${index + 1}. ${product.name}\n`
    message += `   💰 ₱${product.price || "Varies"}\n`
    if (product.description) message += `   📝 ${product.description}\n`
    message += `\n`

    const label = `${product.name} – ₱${product.price || "Varies"}`
    const callbackData = `product_${product.id}`

    if (label.length > 30) {
      keyboard.text(label, callbackData).row()
    } else {
      tempRow.push({ label, callbackData })
      if (tempRow.length === 2) {
        keyboard
          .text(tempRow[0].label, tempRow[0].callbackData)
          .text(tempRow[1].label, tempRow[1].callbackData)
          .row()
        tempRow = []
      }
    }
  })

  if (tempRow.length === 1) {
    keyboard.text(tempRow[0].label, tempRow[0].callbackData).row()
  }

  keyboard.text("🔙 Balik sa Categories", "start_shopping")

  await ctx.editMessageText(message, { reply_markup: keyboard })
}

// Show Individual Product Details
export async function showProductDetails(ctx, productId) {
  let product = null
  let categoryKey = null

  for (const [key, cat] of Object.entries(productData)) {
    const found = cat.items.find((p) => p.id === productId)
    if (found) {
      product = found
      categoryKey = key
      break
    }
  }

  if (!product) {
    await ctx.editMessageText("Awts, indi ko makita ang item mo bes! 😅")
    return
  }

  let message = `🛍️ ${product.name}\n\n`
  if (product.description) message += `📝 ${product.description}\n\n`

  const keyboard = new InlineKeyboard()

  if (product.variants && product.variants.length > 0) {
    message += "Pili variant mo, dai:\n\n"
    product.variants.forEach((variant, index) => {
      message += `${index + 1}. ${variant.name} - ₱${variant.price}\n`
      keyboard.text(`${variant.name} – ₱${variant.price}`, `variant_${productId}_${index}`)
      if ((index + 1) % 2 === 0) keyboard.row()
    })
  } else {
    message += `💰 Price: ₱${product.price}\n`
    keyboard.text("🛒 Ibutang sa Cart", `add_to_cart_${productId}`)
  }

  keyboard.row().text("🔙 Balik", `category_${categoryKey}`)

  await ctx.editMessageText(message, { reply_markup: keyboard })
}

// Add to Cart
export async function addToCart(ctx, productId, variantIndex = null) {
  const userId = ctx.from.id

  try {
    let product = null
    for (const cat of Object.values(productData)) {
      const found = cat.items.find((p) => p.id === productId)
      if (found) {
        product = found
        break
      }
    }

    if (!product) {
      await ctx.answerCallbackQuery("Waay ko na-found ang item, bes!")
      return
    }

    const user = await User.findOne({ telegramId: userId }) || new User({ telegramId: userId, cart: [] })

    const cartItem = {
      productId,
      productName: product.name,
      variantIndex,
      variantName: variantIndex !== null ? product.variants[variantIndex].name : null,
      price: variantIndex !== null ? product.variants[variantIndex].price : product.price,
      quantity: 1,
      addedAt: new Date(),
    }

    user.cart.push(cartItem)
    await user.save()

    const itemName = cartItem.variantName ? `${product.name} (${cartItem.variantName})` : product.name

    await ctx.answerCallbackQuery(`✅ Gindugang ta na ang '${itemName}' sa cart mo, gurl!`)

    const keyboard = new InlineKeyboard()
      .text("🛒 Tan-aw Cart", "view_cart")
      .text("➕ Dugang Pa", "start_shopping")
      .text("💳 Checkout Na!", "checkout")

    await ctx.editMessageText(
      `✅ NADUGANG NA SA CART! 🛒\n\n${itemName}\n💰 ₱${cartItem.price}\n\nAno next move mo, besh?`,
      { reply_markup: keyboard },
    )
  } catch (error) {
    console.error("Error adding to cart:", error)
    await ctx.answerCallbackQuery("Ay bes, error sa pagdugang! 😭")
  }
}

// Add More Handler
export async function handleAddMore(ctx) {
  try {
    await ctx.answerCallbackQuery("G! Pili pa kita bes, damo pa ya! 💅")
    await showCategories(ctx)
  } catch (error) {
    console.error("Error in handleAddMore:", error)
    await ctx.reply("Ay teh, nagka-error kita. Wait lang anay ha! 😅")
  }
}

// Show Cart
export async function showCart(ctx) {
  const userId = ctx.from.id

  try {
    const user = await User.findOne({ telegramId: userId })

    if (!user?.cart || user.cart.length === 0) {
      const keyboard = new InlineKeyboard()
        .text("🛍️ Shopping Ta Na!", "start_shopping")
        .text("🔙 Balik Menu", "back_to_menu")

      await ctx.editMessageText("🛒 WALAY LAMAN ANG CART MO\n\nBes, indi pwede empty ang cart ha! Time to shop-shoop! 💅", {
        reply_markup: keyboard,
      })
      return
    }

    let message = "🛒 ANG CART MO NGA PASABOG\n\n"
    let total = 0

    user.cart.forEach((item, index) => {
      const itemName = item.variantName ? `${item.productName} (${item.variantName})` : item.productName
      const subtotal = item.price * item.quantity
      message += `${index + 1}. ${itemName}\n   💰 ₱${item.price} x ${item.quantity}\n   💵 Subtotal: ₱${subtotal}\n\n`
      total += subtotal
    })

    message += `💎 TOTAL NA BES: ₱${total}\n\nReady ka na mag-checkout, or dugang pa? 😉`

    const keyboard = new InlineKeyboard()
      .text("💳 Checkout Na Dayon!", "checkout")
      .text("➕ Dugang pa Item", "start_shopping")
      .text("🗑️ Clear ang Cart", "clear_cart")
      .text("🔙 Balik Menu", "back_to_menu")

    await ctx.editMessageText(message, { reply_markup: keyboard })
  } catch (error) {
    console.error("Error showing cart:", error)
    await ctx.reply("Ay teh, indi makita cart mo subong! Wait lang ha.")
  }
}
