// Only allow the customer workspace as an authentication return destination.
export function customerReturnPath(value: unknown): string {
  if (value === "/services/requests") return value;
  return typeof value === "string" && /^\/customer(?:\/|\?|$)/.test(value) && !/[\\\r\n]/.test(value) ? value : "/customer";
}
