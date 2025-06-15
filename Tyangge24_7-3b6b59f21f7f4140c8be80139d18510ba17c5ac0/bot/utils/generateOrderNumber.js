export function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `ORD-${timestamp}-${random}`;
}
