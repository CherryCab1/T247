import { User } from "../../models/index.js"

// Check kung approved na ang beks
export async function checkUserApproval(ctx, next) {
  const userId = ctx.from.id

  try {
    const user = await User.findOne({ telegramId: userId })

    if (!user || user.status !== "approved") {
      await ctx.reply("🚫 Hala gurl, hindi ka pa approved! Gapaabot lang anay ha, ginapa-check ka pa sang mga dyosa sa admin! 💖⏳")
      return
    }

    await next()
  } catch (error) {
    console.error("Error checking user approval:", error)
    await ctx.reply("⚠️ Ay mare, may naglagas nga bug! Try mo lang liwat later ha! 😅")
  }
}

// Log kung active pa si beks
export async function logInteraction(ctx, next) {
  const userId = ctx.from?.id

  if (userId) {
    try {
      // Update ang chika ni beks
      await User.updateOne(
        { telegramId: userId },
        {
          lastActive: new Date(),
          isOnline: true,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
        },
      )
    } catch (error) {
      console.error("Error logging interaction:", error)
      // Silent lang mare, di na natin kailangan i-drama to sa front-end 😂
    }
  }

  await next()
}
