import mongoose from "mongoose";
import { PendingOrderApproval } from "./pendingOrderApproval.js";

// User Schema
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: String,
  firstName: String,
  lastName: String,
  status: {
    type: String,
    enum: ["pending", "approved", "denied"],
    default: "pending",
    index: true,
  },
  ageVerified: { type: Boolean, default: false },
  isVIP: { type: Boolean, default: false },
  essentialsPIN: String,
  pinExpiresAt: Date,
  waitingForPIN: { type: Boolean, default: false },
  cart: [
    {
      productId: String,
      productName: String,
      variantIndex: Number,
      variantName: String,
      price: Number,
      quantity: { type: Number, default: 1 },
      addedAt: { type: Date, default: Date.now },
    },
  ],
  checkoutData: {
    name: String,
    deliveryMethod: String,
    contact: String,
    location: {
      latitude: Number,
      longitude: Number,
      resolvedAddress: String,
    },
    addressNote: String,
    mobile: String,
    deliveryFee: Number,
    grandTotal: Number,
  },
  checkoutStep: String,
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now, index: true },
  isOnline: { type: Boolean, default: false },
});

// Order Schema
const orderSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  username: String,
  orderNumber: { type: String, required: true, unique: true, index: true },
  items: [
    {
      productId: String,
      productName: String,
      variantIndex: Number,
      variantName: String,
      price: Number,
      quantity: Number,
    },
  ],
  customerInfo: {
    name: String,
    deliveryMethod: String,
    contact: String,
    location: {
      latitude: Number,
      longitude: Number,
      resolvedAddress: String,
    },
    addressNote: String,
  },
  subtotal: Number,
  deliveryFee: Number,
  total: Number,
  status: {
    type: String,
    enum: [
      "pending_payment",
      "awaiting_payment", // Added to allow admin approval flow
      "paid",
      "preparing",
      "en_route",
      "delivered",
      "cancelled"
    ],
    default: "pending_payment",
    index: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "expired"],
    default: "pending",
    index: true,
  },
  paymentUrl: String,
  xenditInvoiceId: String,
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

// Chat Log Schema
const chatLogSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  username: String,
  firstName: String,
  lastName: String,
  messageType: {
    type: String,
    enum: ["text", "photo", "document", "location", "callback_query", "command"],
    required: true,
  },
  messageText: String,
  callbackData: String,
  command: String,
  timestamp: { type: Date, default: Date.now, index: true },
  isFromAdmin: { type: Boolean, default: false },
});

// Pending Approval Schema
const pendingApprovalSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  chatId: Number,
  requestedAt: { type: Date, default: Date.now, index: true },
});

// Payment Transaction Schema
const paymentTransactionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  orderNumber: String,
  telegramId: Number,
  xenditInvoiceId: String,
  amount: Number,
  status: {
    type: String,
    enum: ["pending", "paid", "failed", "expired"],
    default: "pending",
  },
  paymentUrl: String,
  paidAt: Date,
  expiresAt: Date,
  webhookData: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create indexes
userSchema.index({ telegramId: 1, status: 1 });
orderSchema.index({ telegramId: 1, createdAt: -1 });
chatLogSchema.index({ telegramId: 1, timestamp: -1 });

export const User = mongoose.model("User", userSchema);
export const Order = mongoose.model("Order", orderSchema);
export const ChatLog = mongoose.model("ChatLog", chatLogSchema);
export const PendingApproval = mongoose.model("pendingApproval", pendingApprovalSchema);
export const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);
export { PendingOrderApproval } from "./pendingOrderApproval.js";
