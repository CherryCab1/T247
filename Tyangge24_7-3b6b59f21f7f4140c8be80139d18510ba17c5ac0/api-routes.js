import express from "express"
import { User, Order, ChatLog, PaymentTransaction, AdminMessage } from "./models.js"
import { bot } from "./index.js"

const router = express.Router()

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"]
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

// Get dashboard stats
router.get("/stats", authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const approvedUsers = await User.countDocuments({ status: "approved" })
    const pendingUsers = await User.countDocuments({ status: "pending" })
    const vipUsers = await User.countDocuments({ isVIP: true })
    const onlineUsers = await User.countDocuments({ isOnline: true })

    const totalOrders = await Order.countDocuments()
    const pendingPaymentOrders = await Order.countDocuments({ status: "pending_payment" })
    const paidOrders = await Order.countDocuments({ paymentStatus: "paid" })
    const completedOrders = await Order.countDocuments({ status: "delivered" })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today },
    })

    const todayRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ])

    res.json({
      users: {
        total: totalUsers,
        approved: approvedUsers,
        pending: pendingUsers,
        vip: vipUsers,
        online: onlineUsers,
      },
      orders: {
        total: totalOrders,
        pendingPayment: pendingPaymentOrders,
        paid: paidOrders,
        completed: completedOrders,
        today: todayOrders,
      },
      revenue: {
        today: todayRevenue[0]?.total || 0,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get all orders with payment status
router.get("/orders", authenticateAdmin, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const orders = await Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit)

    // Get payment transactions for these orders
    const orderIds = orders.map((order) => order._id)
    const paymentTransactions = await PaymentTransaction.find({
      orderId: { $in: orderIds },
    })

    // Merge payment data with orders
    const ordersWithPayments = orders.map((order) => {
      const payment = paymentTransactions.find((p) => p.orderId.toString() === order._id.toString())
      return {
        ...order.toObject(),
        paymentTransaction: payment,
      }
    })

    const total = await Order.countDocuments()

    res.json({
      orders: ordersWithPayments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create payment link
router.post("/create-payment/:orderId", authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)

    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }

    // Create Xendit invoice
    const invoiceData = {
      external_id: order.orderNumber,
      amount: order.total,
      description: `Tyangge 24/7 Order #${order.orderNumber}`,
      invoice_duration: 86400, // 24 hours
      customer: {
        given_names: order.customerInfo.name,
        mobile_number: order.customerInfo.contact,
      },
      success_redirect_url: `${process.env.WEBHOOK_URL}/payment-success`,
      failure_redirect_url: `${process.env.WEBHOOK_URL}/payment-failed`,
      currency: "PHP",
      items: order.items.map((item) => ({
        name: item.variantName ? `${item.productName} (${item.variantName})` : item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
    }

    const xenditResponse = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.XENDIT_API_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoiceData),
    })

    if (!xenditResponse.ok) {
      const errorData = await xenditResponse.json()
      throw new Error(`Xendit API error: ${errorData.message}`)
    }

    const xenditData = await xenditResponse.json()

    // Save payment transaction
    const paymentTransaction = new PaymentTransaction({
      orderId: order._id,
      orderNumber: order.orderNumber,
      telegramId: order.telegramId,
      xenditInvoiceId: xenditData.id,
      amount: order.total,
      status: "pending",
      paymentUrl: xenditData.invoice_url,
      expiresAt: new Date(xenditData.expiry_date),
      webhookData: xenditData,
    })

    await paymentTransaction.save()

    // Update order
    await Order.findByIdAndUpdate(orderId, {
      xenditInvoiceId: xenditData.id,
      paymentUrl: xenditData.invoice_url,
      updatedAt: new Date(),
    })

    // Send payment link to customer
    const paymentMsg =
      `💳 PAYMENT LINK READY! 💅\n\n` +
      `Order #${order.orderNumber}\n` +
      `Amount: ₱${order.total}\n\n` +
      `Click here to pay:\n${xenditData.invoice_url}\n\n` +
      `⏰ Link expires in 24 hours!\n` +
      `After payment, we'll automatically confirm your order! ✨`

    await bot.api.sendMessage(order.telegramId, paymentMsg)

    res.json({
      success: true,
      paymentUrl: xenditData.invoice_url,
      invoiceId: xenditData.id,
      expiresAt: xenditData.expiry_date,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get chat logs
router.get("/chat-logs", authenticateAdmin, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 50
    const userId = req.query.userId
    const skip = (page - 1) * limit

    const filter = userId ? { telegramId: Number.parseInt(userId) } : {}

    const chatLogs = await ChatLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit)

    const total = await ChatLog.countDocuments(filter)

    res.json({
      chatLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get active conversations
router.get("/active-conversations", authenticateAdmin, async (req, res) => {
  try {
    const activeUsers = await User.find({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    })
      .sort({ lastActive: -1 })
      .select("telegramId username firstName lastName lastActive isOnline")

    const conversations = await Promise.all(
      activeUsers.map(async (user) => {
        const lastMessage = await ChatLog.findOne({ telegramId: user.telegramId }).sort({ timestamp: -1 })

        const unreadCount = await AdminMessage.countDocuments({
          targetUserId: user.telegramId,
          read: false,
        })

        return {
          user,
          lastMessage,
          unreadCount,
        }
      }),
    )

    res.json(conversations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Send message to user
router.post("/send-message", authenticateAdmin, async (req, res) => {
  try {
    const { userId, message, messageType = "text" } = req.body

    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message are required" })
    }

    // Send message via bot
    const sentMessage = await bot.api.sendMessage(userId, message)

    // Log admin message
    const adminMessage = new AdminMessage({
      adminId: req.headers["x-admin-id"] || 0,
      targetUserId: userId,
      message,
      messageType,
      delivered: true,
      sentAt: new Date(),
    })

    await adminMessage.save()

    // Log as chat interaction
    const chatLog = new ChatLog({
      telegramId: userId,
      messageType: "text",
      messageText: message,
      botResponse: message,
      timestamp: new Date(),
      isFromAdmin: true,
    })

    await chatLog.save()

    res.json({
      success: true,
      messageId: sentMessage.message_id,
      sentAt: new Date(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update order status
router.put("/orders/:orderId/status", authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params
    const { status } = req.body

    const order = await Order.findByIdAndUpdate(orderId, { status, updatedAt: new Date() }, { new: true })

    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }

    // Notify customer
    const statusMessages = {
      paid: "✅ Payment confirmed! Your order is now being prepared! 💅",
      preparing: "📦 Your fabulous order is being prepared! Almost ready, bes!",
      en_route: "🚚 Your order is on the way! Get ready to receive your goodies! 💖",
      delivered: "✅ Order delivered! Enjoy your purchase, gurl! Rate us 5 stars! ⭐",
      cancelled: "❌ Sorry bes, your order has been cancelled. Contact us for refund details.",
    }

    if (statusMessages[status]) {
      await bot.api.sendMessage(
        order.telegramId,
        `📦 ORDER UPDATE - #${order.orderNumber}\n\n${statusMessages[status]}`,
      )
    }

    res.json({ success: true, order })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
