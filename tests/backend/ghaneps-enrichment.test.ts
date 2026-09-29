import assert from "node:assert/strict";
import test from "node:test";
import { parseGhanepsDetail } from "../../lib/server/procurement/ghana-adapters.ts";

test("GHANEPS detail fields use stable human-readable keys", () => {
  const html = `<dl>
    <dt>Tender Participation Fees:</dt><dd>Participation Fee Required</dd>
    <dt>Payment Amount&nbsp;(GHS):</dt><dd>500</dd>
    <dt>Payment Terms and Method:</dt><dd>Payment through Ghana.gov portal</dd>
    <dt>Bid Security Type:</dt><dd>Bid Security Required</dd>
    <dt>Bid Security Amount Type:</dt><dd>Percentage</dd>
    <dt>Bid Security Amount&nbsp;(GHS):</dt><dd>2</dd>
    <dt>Contract Awarded in Lots:</dt><dd>No</dd>
  </dl>`;
  const result = parseGhanepsDetail(html);
  assert.equal(result.fields["Payment Amount (GHS)"], "500");
  assert.equal(result.fields["Bid Security Amount (GHS)"], "2");
  assert.equal(result.fields["Bid Security Amount Type"], "Percentage");
  assert.equal(result.fields["Payment Terms and Method"], "Payment through Ghana.gov portal");
});

test("GHANEPS notice date does not absorb the website footer", () => {
  const valid = parseGhanepsDetail("Contract Notice Date: 29/09/2026 ©2026 European Dynamics");
  assert.equal(valid.fields["Contract Notice Date"], "29/09/2026");
  const footerOnly = parseGhanepsDetail("Contract Notice Date: ©2026 European Dynamics");
  assert.equal(footerOnly.fields["Contract Notice Date"], undefined);
});

test("GHANEPS procurement method ends before the eAuction field", () => {
  const parsed = parseGhanepsDetail("Procurement Method: National Competitive Tendering Includes eAuction: No Includes eCatalogue: No");
  assert.equal(parsed.fields["Procurement Method"], "National Competitive Tendering");
  assert.equal(parsed.fields["Includes eAuction"], "No");
});

test("GHANEPS lot rules and names are indexed separately", () => {
  const parsed = parseGhanepsDetail("Contract Awarded in Lots: Yes Bids for Lots: One or More Lots Number of Lots: 2 Lot Name (1): Supply of 7 No Station wagon Lot Name (2): Supply of 1 No Sports Utility Vehicle Bid submission deadline date: 29/09/2026 16:00:00");
  assert.equal(parsed.fields["Contract Awarded in Lots"], "Yes");
  assert.equal(parsed.fields["Bids for Lots"], "One or More Lots");
  assert.equal(parsed.fields["Number of Lots"], "2");
  assert.equal(parsed.fields["Lot Name (1)"], "Supply of 7 No Station wagon");
  assert.equal(parsed.fields["Lot Name (2)"], "Supply of 1 No Sports Utility Vehicle");
});
