-- BidScope does not expose bulk opportunity exports to customer accounts.
-- Keep persisted plan entitlements aligned with the enforced API boundary and
-- the customer-facing plan descriptions.
update public.billing_plans
set features = features - 'csv_exports',
    updated_at = now()
where features ? 'csv_exports';
