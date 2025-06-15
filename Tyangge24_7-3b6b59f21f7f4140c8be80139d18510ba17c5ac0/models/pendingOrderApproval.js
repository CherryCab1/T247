const PendingOrderApprovalSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  username: { type: String },
  orderNumber: { type: String, required: true },
  items: { type: Array, required: true },
  customerInfo: { type: Object, required: true },
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  total: { type: Number, required: true },
  paymentStatus: { type: String, default: "pending" },
  status: { type: String, default: "pending_approval" }, // ✅ HERE
  createdAt: { type: Date, default: Date.now },
});
