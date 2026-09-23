import { createHash } from "node:crypto";

export type VerificationLevel = "basic" | "verified" | "enhanced_verified";
export type VerificationCheck = { check_type: string; status: "pending" | "passed" | "failed" | "needs_review" | "not_applicable" };
export type RequestedLevel = Exclude<VerificationLevel,"basic">;

export const VERIFIED_CHECKS = ["company_registration", "company_name_match", "registration_number_match", "document_integrity", "manual_review"] as const;
export const ENHANCED_CHECKS = [...VERIFIED_CHECKS, "tax_clearance", "licence_check", "beneficial_ownership", "address_check", "regulatory_registration"] as const;
export function requiredChecks(level: RequestedLevel) { return level === "verified" ? VERIFIED_CHECKS : ENHANCED_CHECKS; }
export function mayApprove(request: {requested_level:RequestedLevel;payment_status:string}, checks: VerificationCheck[]) {
  if (request.requested_level === "enhanced_verified" && request.payment_status !== "paid") return false;
  return requiredChecks(request.requested_level).every(type => checks.some(check => check.check_type === type && (check.status === "passed" || (request.requested_level === "enhanced_verified" && !VERIFIED_CHECKS.includes(type as typeof VERIFIED_CHECKS[number]) && check.status === "not_applicable"))));
}
export function effectiveLevel(level: VerificationLevel, expiresAt: string | null, now = new Date()): VerificationLevel {
  return level !== "basic" && (!expiresAt || new Date(expiresAt).getTime() <= now.getTime()) ? "basic" : level;
}
export function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
export function documentRisk(bytes: Uint8Array, mime: string, duplicateAcrossOrganizations: boolean) {
  const flags: string[] = [];
  const header = Buffer.from(bytes.subarray(0, 8));
  if (mime === "application/pdf" && !header.toString("latin1").startsWith("%PDF-")) flags.push("file_signature_mismatch");
  if (mime === "image/png" && header.toString("hex") !== "89504e470d0a1a0a") flags.push("file_signature_mismatch");
  if (mime === "image/jpeg" && header.subarray(0, 3).toString("hex") !== "ffd8ff") flags.push("file_signature_mismatch");
  if (duplicateAcrossOrganizations) flags.push("duplicate_across_organizations");
  return { risk: flags.length > 1 || flags.includes("file_signature_mismatch") ? "high" : flags.length ? "medium" : "low", flags } as const;
}
