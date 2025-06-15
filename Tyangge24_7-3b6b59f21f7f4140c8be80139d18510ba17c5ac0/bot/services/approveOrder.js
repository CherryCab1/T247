import { Order } from "../models/order.js";
import { PendingOrderApproval } from "../models/pendingOrderApproval.js";

// Example: Approve a pending order by its MongoDB _id
export async function approveOrder(pendingId) {
  // 1. Find the pending order
  const pending = await PendingOrderApproval.findById(pendingId);
  if (!pending) throw new Error("Pending order not found");

  // 2. Check if order already exists in the Order collection
  const existingOrder = await Order.findOne({ orderNumber: pending.orderNumber });
  if (existingOrder) {
    // Optionally: clean up pending doc if somehow still present
    await PendingOrderApproval.deleteOne({ _id: pending._id });
    return { success: false, message: "Order already approved." };
  }

  // 3. Transfer: copy all relevant fields to Order
  const orderData = {
    telegramId: pending.telegramId,
    username: pending.username,
    orderNumber: pending.orderNumber,
    items: pending.items,
    customerInfo: pending.customerInfo,
    subtotal: pending.subtotal,
    deliveryFee: pending.deliveryFee,
    total: pending.total,
    status: "approved", // Or whatever your workflow requires
    paymentStatus: pending.paymentStatus,
    // Add more fields if needed (createdAt, etc.)
  };

  const order = new Order(orderData);
  await order.save();

  // 4. Remove from pending
  await PendingOrderApproval.deleteOne({ _id: pending._id });

  return { success: true, message: "Order approved and moved to Order collection." };
}
