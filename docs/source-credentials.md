# Procurement source credentials

No secret belongs in source configuration, client JavaScript, Git or documentation. Store secrets in Vercel environment variables and read them only in server routes.

- `UNGM_CLIENT_ID` and `UNGM_CLIENT_SECRET`: required before enabling the UNGM OAuth connector.
- `SAM_GOV_API_KEY`: required before enabling the SAM.gov public opportunities connector.
- `CRON_SECRET` / `INTERNAL_API_SECRET`: protects scheduled and administrative ingestion endpoints.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only database ingestion authority.

After adding a credential, use the source test endpoint, confirm a successful health message, then deliberately change the source to `LIVE`, `ACTIVE`, and `sync_enabled=true`. Never enable a credential-gated source just because an environment-variable name exists.
