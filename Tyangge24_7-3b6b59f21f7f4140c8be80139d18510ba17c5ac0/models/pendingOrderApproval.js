import mongoose from "mongoose";

const pendingOrderApprovalSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  username: { type: String },
  orderNumber: { type: String, required: true },
  items: { type: Array, required: true },
  customerInfo: { type: Object, required: true },
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  total: { type: Number, required: true },
  paymentStatus: { type: String, default: "pending" },
  status: { type: String, default: "pending_approval" },
  createdAt: { type: Date, default: Date.now },
});

export const PendingOrderApproval = mongoose.model(
  "PendingOrderApproval", // 👈 this is the model name in MongoDB
  pendingOrderApprovalSchema
);
