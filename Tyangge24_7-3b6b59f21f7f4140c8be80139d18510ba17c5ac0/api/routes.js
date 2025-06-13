import express from "express"
import { User, Order } from "../models/index.js"
import { config } from "../config/env.js"

const router = express.Router()

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"]
  if (adminKey !== config.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

// Get dashboard stats
router.get("/stats", authenticateAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      approvedUsers,
      pendingUsers,
      vipUsers,
      onlineUsers,
      totalOrders,
      pendingPaymentOrders,
      paidOrders,
      completedOrders,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "approved" }),
      User.countDocuments({ status: "pending" }),
      User.countDocuments({ isVIP: true }),
      User.countDocuments({ isOnline: true }),
      Order.countDocuments(),
      Order.countDocuments({ status: "pending_payment" }),
      Order.countDocuments({ paymentStatus: "paid" }),
      Order.countDocuments({ status: "delivered" }),
    ])

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayOrders, todayRevenue] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today }, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
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
    console.error("Error getting stats:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get orders
router.get("/orders", authenticateAdmin, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(),
    ])

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error getting orders:", error)
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

    res.json({ success: true, order })
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({ error: error.message })
  }
})

export default router
