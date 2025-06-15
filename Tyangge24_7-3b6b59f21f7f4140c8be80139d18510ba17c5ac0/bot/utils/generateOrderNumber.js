export function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000); // random 0-999
  return `ORD-${timestamp}-${random}`;
}
