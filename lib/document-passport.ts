export const DOCUMENT_CATEGORIES = {
  business_registration: "Company registration", tax_clearance: "Tax clearance / TCC",
  ssnit_clearance: "SSNIT clearance", ppa_registration: "PPA documentation",
  certificate: "Certificate", licence: "Licence", insurance: "Insurance",
  audited_accounts: "Audited accounts", financial_statement: "Financial statement",
  reference: "Reference", contract: "Contract", completion_certificate: "Completion certificate",
  staff_cv: "Staff CV", professional_registration: "Professional registration",
  manufacturer_authorisation: "Manufacturer authorisation", policy: "Company policy",
  iso_certificate: "ISO certificate", company_profile: "Company profile", other: "Other supporting document",
} as const;

export const DEFAULT_DOCUMENT_REMINDERS = [90, 60, 30, 14, 7] as const;
export function isOrganizationDocumentPath(path: string, organizationId: string) {
  return /^[a-f0-9-]{36}$/i.test(organizationId) && path.startsWith(`${organizationId}/`) &&
    path.split("/").length === 2 && /^[a-zA-Z0-9._-]+$/.test(path.split("/")[1]) &&
    ![".", ".."].includes(path.split("/")[1]);
}
export type PassportStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY" | "REQUIRES_REVIEW";
export type DocumentDates = { issued_at?: string | null; expires_at: string | null; verification_status?: string };

// Date-only records are valid through the stated calendar day in UTC (Ghana).
export function dateOnlyTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function documentValidity(document: DocumentDates, now = new Date(), deadline?: string | null) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiry = document.expires_at ? dateOnlyTime(document.expires_at) : null;
  const issued = document.issued_at ? dateOnlyTime(document.issued_at) : null;
  const issues: string[] = [];
  if (document.expires_at && expiry === null) issues.push("Expiry date requires review.");
  if (document.issued_at && issued === null) issues.push("Issue date requires review.");
  if (issued !== null && issued > today) issues.push("Issue date is in the future.");
  if (issued !== null && expiry !== null && issued > expiry) issues.push("Issue date is after the expiry date.");
  if (document.verification_status === "rejected") issues.push("Document verification requires review.");
  const daysRemaining = expiry === null ? null : Math.round((expiry - today) / 86400000);
  const deadlineTime = deadline ? Date.parse(deadline) : NaN;
  const expiresBeforeDeadline = expiry !== null && Number.isFinite(deadlineTime) && expiry + 86400000 <= deadlineTime;
  if (expiresBeforeDeadline) issues.push("This document may not remain valid through the tender deadline.");
  const status: PassportStatus = daysRemaining !== null && daysRemaining < 0 ? "EXPIRED"
    : issues.some(issue => issue !== "This document may not remain valid through the tender deadline.") ? "REQUIRES_REVIEW"
    : daysRemaining === null ? "NO_EXPIRY" : daysRemaining <= 90 ? "EXPIRING_SOON" : "VALID";
  return {
    status, daysRemaining, expiresBeforeDeadline, issues,
    usableThroughDeadline: !["EXPIRED", "REQUIRES_REVIEW"].includes(status) && !expiresBeforeDeadline,
    // Date validity is separate from issuer/authenticity verification.
    verified: document.verification_status === "verified",
  };
}

export function documentReminderDays(configured?: number[] | null) {
  return configured == null ? [...DEFAULT_DOCUMENT_REMINDERS]
    : [...new Set(configured.filter(day => Number.isInteger(day) && day >= 1 && day <= 365))];
}
