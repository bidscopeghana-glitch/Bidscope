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
