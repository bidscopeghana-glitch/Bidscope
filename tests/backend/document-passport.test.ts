import test from "node:test";
import assert from "node:assert/strict";
import {dateOnlyTime,documentValidity,documentReminderDays,isOrganizationDocumentPath} from "../../lib/document-passport.ts";

const now=new Date("2026-09-25T12:00:00Z");
test("a document record cannot point the privileged file proxy at another organisation",()=>{
 const own="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
 assert.equal(isOrganizationDocumentPath(`${own}/doc.pdf`,own),true);
 for(const path of [`${other}/doc.pdf`,`${own}/../${other}/doc.pdf`,`${own}/%2e%2e%2fsecret`,`${own}/doc.pdf?x=y`,`${own}/..`])assert.equal(isOrganizationDocumentPath(path,own),false);
});
test("invalid calendar dates and impossible date ranges require review",()=>{
  assert.equal(dateOnlyTime("2026-02-30"),null);
  assert.equal(documentValidity({expires_at:"2026-02-30"},now).status,"REQUIRES_REVIEW");
  assert.equal(documentValidity({issued_at:"2026-09-26",expires_at:"2026-09-25"},now).status,"REQUIRES_REVIEW");
});
test("date-only expiry is inclusive of the expiry day, independent of cron time",()=>{
  for(const hour of ["00:00:00","12:00:00","23:59:59"]){
    const result=documentValidity({expires_at:"2026-09-25"},new Date(`2026-09-25T${hour}Z`));
    assert.equal(result.daysRemaining,0);
    assert.equal(result.usableThroughDeadline,true);
  }
  assert.equal(documentValidity({expires_at:"2026-09-24"},now).status,"EXPIRED");
});
test("documents that expire before tender close are not ready for that tender",()=>{
  const doc={expires_at:"2026-10-01",verification_status:"verified"};
  assert.equal(documentValidity(doc,now,"2026-10-01T23:59:59Z").usableThroughDeadline,true);
  const result=documentValidity(doc,now,"2026-10-02T00:00:00Z");
  assert.equal(result.expiresBeforeDeadline,true);
  assert.equal(result.usableThroughDeadline,false);
  assert.match(result.issues.join(" "),/may not remain valid/);
});
test("expiry state never implies issuer verification",()=>{
  assert.equal(documentValidity({expires_at:null,verification_status:"needs_review"},now).verified,false);
  assert.equal(documentValidity({expires_at:null},now).status,"NO_EXPIRY");
  assert.equal(documentValidity({expires_at:"2027-12-31",verification_status:"rejected"},now).usableThroughDeadline,false);
  assert.equal(documentValidity({expires_at:"2027-12-31"},now).status,"VALID");
});
test("reminders use required defaults, preserve explicit opt-out and allow customised thresholds",()=>{
  assert.deepEqual(documentReminderDays(),[90,60,30,14,7]);
  assert.deepEqual(documentReminderDays([]),[]);
  assert.deepEqual(documentReminderDays([365,120,120,0,-1,366,1.5]),[365,120]);
  assert.equal(documentValidity({expires_at:"2026-12-24"},now).daysRemaining,90);
});
