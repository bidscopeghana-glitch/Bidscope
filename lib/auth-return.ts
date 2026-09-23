// Keep authentication returns on a known BidScope workspace route. Authorization
// still happens inside each destination; this only prevents external redirects.
export function customerReturnPath(value: unknown): string {
  if (value === "/services/requests") return value;
  return typeof value === "string"
    && /^\/(?:customer|procurement|admin\/command-centre)(?:\/|\?|$)/.test(value)
    && !/[\\\r\n]/.test(value)
    ? value
    : "/customer";
}
