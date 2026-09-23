import assert from "node:assert/strict";
import test from "node:test";
import { canonicalUrl, classifyDuplicate, contentHash, extractDiscovery, normalizedWords, reviewReason } from "../../lib/server/discovery/core.ts";

const notice = {
  url: "https://example.gov.gh/tenders/123",
  status: "completed",
  metadata: { title: "Supply & Installation of Medical Equipment" },
  markdown: "# Supply & Installation of Medical Equipment\nBuyer: Ghana Health Service\nTender Reference: GHS/2026/1234\nClosing date: 30 September 2026\nEligible bidders: registered suppliers",
};
const existing = { id: "t1", title: "Supply and Installation of Medical Equipment - Ghana Health Service", buyer_name: "Ghana Health Service", external_reference: "GHS/2026/1234", official_source_url: "https://example.gov.gh/tenders/123", deadline_at: "2026-09-30T00:00:00.000Z", category: "goods" };

test("canonical URL removes tracking while preserving identity", () => assert.equal(canonicalUrl("https://EXAMPLE.gov.gh/tenders/123/?utm_source=a#part"), notice.url));
test("title normalization unifies ampersand and punctuation", () => assert.deepEqual(normalizedWords("Supply & Installation"), normalizedWords("SUPPLY and INSTALLATION!")));
test("extracts only explicitly stated tender fields", () => {
  const extracted = extractDiscovery(notice);
  assert.equal(extracted.buyer, "Ghana Health Service");
  assert.equal(extracted.reference, "GHS/2026/1234");
  assert.equal(extracted.deadline?.slice(0, 10), "2026-09-30");
  assert.equal(extracted.contactEmail, null);
});
test("exact duplicate by reference", () => assert.equal(classifyDuplicate(extractDiscovery(notice), "https://other.gov.gh/123", [existing]).status, "exact_duplicate"));
test("exact duplicate by canonical URL across source metadata", () => assert.equal(classifyDuplicate({ ...extractDiscovery(notice), reference: null }, `${notice.url}?utm_source=x`, [existing]).status, "exact_duplicate"));
test("probable duplicate uses title, buyer, deadline and category", () => {
  const candidate = { ...existing, external_reference: null, official_source_url: "https://other.gov.gh/tender/123" };
  assert.equal(classifyDuplicate({ ...extractDiscovery(notice), reference: null }, notice.url, [candidate]).status, "probable_duplicate");
});
test("two legitimate source pages resolve to one matching tender", () => {
  const result = classifyDuplicate({ ...extractDiscovery(notice), reference: null }, "https://other.gov.gh/tender/123", [{ ...existing, external_reference: null }]);
  assert.equal(result.matchId, "t1");
});
test("unique notice is not labelled a duplicate", () => assert.equal(classifyDuplicate(extractDiscovery(notice), notice.url, []).status, "unique"));
test("unchanged page has stable hash and changed page does not", () => {
  assert.equal(contentHash(notice), contentHash({ ...notice }));
  assert.notEqual(contentHash(notice), contentHash({ ...notice, markdown: notice.markdown + " Amendment" }));
});
test("expired tender is withheld", () => assert.match(reviewReason(extractDiscovery(notice), new Date("2026-10-01")) || "", /expired/i));
test("malformed non-tender page is withheld", () => assert.match(reviewReason(extractDiscovery({ url: notice.url, status: "completed", markdown: "Contact us" })) || "", /Missing/));
test("canonical URL sorts identity-bearing query parameters", () => {
  assert.equal(canonicalUrl("https://example.gov.gh/tender?z=2&a=1"), "https://example.gov.gh/tender?a=1&z=2");
});
test("canonical URL rejects non-web schemes", () => {
  assert.throws(() => canonicalUrl("javascript:alert(1)"), /HTTP/);
});
test("canonical URL strips click identifiers but keeps tender identifiers", () => {
  assert.equal(canonicalUrl("https://example.gov.gh/tender?id=17&gclid=x&fbclid=y"), "https://example.gov.gh/tender?id=17");
});
test("missing buyer blocks publication even with a title and deadline", () => {
  const extracted = { ...extractDiscovery(notice), buyer: null };
  assert.match(reviewReason(extracted, new Date("2026-09-23")) || "", /Missing/);
});
test("future tender with procurement evidence may proceed to review", () => {
  assert.equal(reviewReason(extractDiscovery(notice), new Date("2026-09-23")), null);
});
test("a non-procurement record is withheld despite structural fields", () => {
  const extracted = { ...extractDiscovery(notice), title: "Annual report", description: "A report about annual expenditure." };
  assert.match(reviewReason(extracted, new Date("2026-09-23")) || "", /intent/i);
});
test("different references do not force an exact match", () => {
  const candidate = { ...existing, external_reference: "OTHER-REF", official_source_url: "https://other.gov.gh/notice" };
  assert.notEqual(classifyDuplicate(extractDiscovery(notice), notice.url, [candidate]).status, "exact_duplicate");
});
test("pages without a shared title or buyer remain unique", () => {
  const candidate = { ...existing, external_reference: null, official_source_url: "https://other.gov.gh/notice", title: "Road bridge construction", buyer_name: "Ministry of Roads" };
  assert.equal(classifyDuplicate({ ...extractDiscovery(notice), reference: null }, notice.url, [candidate]).status, "unique");
});
test("content hash ignores whitespace-only changes", () => {
  assert.equal(contentHash(notice), contentHash({ ...notice, markdown: notice.markdown.replace(/\n/g, "   ") }));
});
