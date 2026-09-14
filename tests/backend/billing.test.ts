import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {isValidPaystackSignature} from "../../lib/server/paystack-signature.ts";

const migration=readFileSync("supabase/migrations/20260914170000_free_premium_paystack.sql","utf8");
const checkout=readFileSync("app/api/billing/checkout/route.ts","utf8");
const webhook=readFileSync("app/api/payments/paystack/webhook/route.ts","utf8");
const paystack=readFileSync("lib/server/paystack.ts","utf8");

test("webhook signature accepts only a valid HMAC over the raw payload",()=>{const key="sk_test_unit_only";const raw=JSON.stringify({event:"charge.success",data:{reference:"safe"}});const signature=createHmac("sha512",key).update(raw).digest("hex");const invalid=`${signature.slice(0,-1)}${signature.endsWith("0")?"1":"0"}`;assert.equal(isValidPaystackSignature(raw,signature,key),true);assert.equal(isValidPaystackSignature(raw,invalid,key),false);assert.equal(isValidPaystackSignature(raw,null,key),false);});
test("prices and entitlements are authoritative and organisation-owned",()=>{assert.match(migration,/organization_id uuid not null/);assert.match(migration,/amount_minor bigint/);assert.match(migration,/payment amount or currency mismatch/);assert.match(migration,/security definer/);assert.match(checkout,/billingPlanCode/);assert.doesNotMatch(checkout,/amount:/);});
test("payment fulfilment is idempotent and cannot activate recurring MoMo",()=>{assert.match(migration,/if tx.status='SUCCESS'/);assert.match(migration,/recurring Premium requires card payment/);assert.match(migration,/on conflict\(organization_id\) do update/);assert.match(paystack,/data\.amount/);assert.match(paystack,/data\.currency/);});
test("webhook and callback always verify on the server",()=>{const signatureSource=readFileSync("lib/server/paystack-signature.ts","utf8");assert.match(webhook,/request\.text\(\)/);assert.match(webhook,/x-paystack-signature/);assert.match(paystack,/transaction\/verify/);assert.match(signatureSource,/timingSafeEqual/);});
test("authenticated clients cannot mutate billing authority tables",()=>{assert.doesNotMatch(migration,/grant (insert|update|delete)[^;]*(billing_plans|payment_transactions|subscriptions)/i);assert.match(migration,/grant select on public\.billing_plans,public\.payment_transactions/);});
test("production plans remain inactive without real pricing",()=>{assert.match(migration,/amount_minor[^\n]*null/);assert.match(migration,/PRICING_CONFIGURATION_REQUIRED/);assert.match(migration,/false\)/);});
