import { randomUUID } from "node:crypto";
import { supabaseRest } from "../supabase-rest";
import { deduplicationKeys } from "./deduplication";
import { stableHash } from "./safety";
import type { NormalizedAward, NormalizedOpportunity, NormalizedProject, ProcurementSource } from "./types";

type IngestionTotals = { fetched: number; inserted: number; updated: number; duplicates: number; failed: number; errors: string[] };
const amendmentFields = ["title","deadline_at","eligibility_text","documents_url","procurement_method","contact_email","contact_phone","official_submission_url","submission_method","status","summary","description"] as const;

function safe(value: string) { return encodeURIComponent(value.replace(/[(),*]/g, " ")); }

async function findExisting(record: NormalizedOpportunity) {
  if (record.external_reference) {
    const { data } = await supabaseRest<Array<{ id: string }>>(`procurement_opportunities?select=id&external_reference=eq.${safe(record.external_reference)}&limit=1`);
    if (data[0]) return data[0].id;
  }
  const { data } = await supabaseRest<Array<{ id: string }>>(`procurement_opportunities?select=id&document_fingerprint=eq.${safe(record.document_fingerprint)}&limit=1`);
  return data[0]?.id || null;
}

async function findExistingSourceRecord(sourceId: string, externalId: string | null) {
  if (!externalId) return null;
  const { data } = await supabaseRest<Array<{ opportunity_id: string }>>(`opportunity_sources?select=opportunity_id&source_id=eq.${sourceId}&external_id=eq.${safe(externalId)}&limit=1`);
  return data[0]?.opportunity_id || null;
}

export async function ingestNormalizedRecords(source: ProcurementSource, records: NormalizedOpportunity[], actorUserId?: string) {
  const totals: IngestionTotals = { fetched: records.length, inserted: 0, updated: 0, duplicates: 0, failed: 0, errors: [] };
  const { data: runs } = await supabaseRest<Array<{ id: string }>>("source_sync_runs", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ source_id: source.id, triggered_by: actorUserId ? "admin" : "schedule", actor_user_id: actorUserId || null, records_fetched: records.length }),
  });
  const runId = runs[0]?.id;

  if (records.length) {
    await supabaseRest("procurement_raw_records?on_conflict=source_id,source_hash", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(records.map((record) => ({ source_id: source.id, sync_run_id: runId || null, external_id: record.external_opportunity_id, source_hash: record.raw_source_hash, payload: record.raw_payload, normalization_status: "ACCEPTED" }))),
    });
  }

  for (let start = 0; start < records.length; start += 10) {
    await Promise.all(records.slice(start, start + 10).map(async (record) => {
      try {
      const sameSourceId = await findExistingSourceRecord(source.id, record.external_opportunity_id);
      const existingId = sameSourceId || await findExisting(record);
      const opportunityId = existingId || randomUUID();
      const body = { ...record, id: opportunityId, source_id: source.id, bidscope_reference: record.bidscope_reference || `BS-${randomUUID().slice(0, 10).toUpperCase()}` };
      let previous:Record<string,unknown>|null=null;
      if(sameSourceId){const{data}=await supabaseRest<Record<string,unknown>[]>(`procurement_opportunities?select=${amendmentFields.join(",")},raw_source_hash&id=eq.${opportunityId}&limit=1`);previous=data[0]||null;}
      if (!existingId || sameSourceId) {
        await supabaseRest(`procurement_opportunities?on_conflict=id`, {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body),
        });
      }
      await supabaseRest("opportunity_sources?on_conflict=source_id,external_id", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ opportunity_id: opportunityId, source_id: source.id, external_id: record.external_opportunity_id || stableHash(deduplicationKeys(record)), official_url: record.official_tender_url || record.official_source_url, submission_url: record.official_submission_url, source_resource_id: record.source_resource_id, document_fingerprint: record.document_fingerprint, is_preferred: !existingId, last_verified_at: record.last_verified_at }),
      });
      if (sameSourceId) totals.updated += 1;
      else if (existingId) totals.duplicates += 1;
      else totals.inserted += 1;
      const eventBase={entity_type:"opportunity",entity_id:opportunityId};
      if(!existingId){await supabaseRest("procurement_events?on_conflict=dedupe_key",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({...eventBase,event_type:"OPPORTUNITY_CREATED",payload:{source_id:source.id},dedupe_key:`opportunity-created:${opportunityId}`})});}
      if(previous){const changes=amendmentFields.flatMap(field=>{const before=previous?.[field]??null;const after=(record as unknown as Record<string,unknown>)[field]??null;return JSON.stringify(before)===JSON.stringify(after)?[]:[{field,previous:before,current:after}];});if(changes.length){await supabaseRest("opportunity_revisions?on_conflict=opportunity_id,source_hash",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({opportunity_id:opportunityId,source_id:source.id,source_hash:record.raw_source_hash,snapshot:body,changed_fields:changes,verified_at:record.last_verified_at})});await supabaseRest("procurement_events?on_conflict=dedupe_key",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({...eventBase,event_type:"OPPORTUNITY_AMENDED",payload:{changes,source_id:source.id},dedupe_key:`opportunity-amended:${opportunityId}:${record.raw_source_hash}`})});}}
      } catch (error) {
        totals.failed += 1;
        totals.errors.push(error instanceof Error ? error.message.slice(0, 300) : "Unknown record error");
      }
    }));
  }

  const completedAt = new Date().toISOString();
  const status = totals.failed === records.length && records.length > 0 ? "FAILED" : totals.failed ? "PARTIALLY_SUCCEEDED" : "SUCCEEDED";
  if (runId) await supabaseRest(`source_sync_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status, completed_at: completedAt, inserted_count: totals.inserted, updated_count: totals.updated, duplicate_count: totals.duplicates, failed_count: totals.failed, error_summary: totals.errors[0] || null, error_details: totals.errors }) });
  await supabaseRest(`procurement_sources?id=eq.${source.id}`, { method: "PATCH", body: JSON.stringify({ last_sync_at: completedAt, last_health_at: completedAt, last_health_message: status, last_record_at: records.length ? completedAt : undefined, ...(status === "SUCCEEDED" ? { last_success_at: completedAt, last_error: null, status: "ACTIVE", consecutive_failures: 0 } : { last_error: totals.errors[0] || "Sync failed", status: "DEGRADED" }) }) });
  return { runId, ...totals, status };
}

export async function ingestProjects(source: ProcurementSource, projects: NormalizedProject[]) {
  if (!projects.length) return { projects: 0 };
  await supabaseRest("procurement_projects?on_conflict=source_id,external_project_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(projects.map((project) => ({ ...project, source_id: source.id }))),
  });
  for (const project of projects) {
    const { data } = await supabaseRest<Array<{ id: string }>>(`procurement_projects?select=id&source_id=eq.${source.id}&external_project_id=eq.${safe(project.external_project_id)}&limit=1`);
    if (data[0]) await supabaseRest(`procurement_opportunities?source_id=eq.${source.id}&source_resource_id=eq.${safe(project.external_project_id)}`, { method: "PATCH", body: JSON.stringify({ project_id: data[0].id }) });
  }
  return { projects: projects.length };
}

export async function ingestAwards(source: ProcurementSource, awards: NormalizedAward[]) {
  let imported = 0;
  for (const award of awards) {
    const { data: projects } = award.project_external_id ? await supabaseRest<Array<{ id: string }>>(`procurement_projects?select=id&source_id=eq.${source.id}&external_project_id=eq.${safe(award.project_external_id)}&limit=1`) : { data: [] };
    const { data: opportunities } = award.project_external_id ? await supabaseRest<Array<{ id: string }>>(`procurement_opportunities?select=id&source_id=eq.${source.id}&source_resource_id=eq.${safe(award.project_external_id)}&order=published_at.desc&limit=1`) : { data: [] };
    const { data: rows } = await supabaseRest<Array<{ id: string }>>("awards?on_conflict=country_code,source_key", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ source_key: `world-bank:${award.external_award_id}`, procurement_source_id: source.id, project_id: projects[0]?.id || null, opportunity_id: opportunities[0]?.id || null, country_code: "GH", title: award.title, reference_number: award.reference_number, award_date: award.award_date?.slice(0, 10) || null, currency: award.currency, award_value: award.value, procurement_method: award.procurement_method, source_url: award.source_url, raw_payload: award.raw_payload, published_at: new Date().toISOString() }),
    });
    const awardId = rows[0]?.id;
    if(awardId)await supabaseRest("procurement_events?on_conflict=dedupe_key",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({event_type:"AWARD_CREATED",entity_type:"award",entity_id:awardId,payload:{opportunity_id:opportunities[0]?.id||null,supplier_name:award.supplier_name,buyer_name:award.buyer_name},dedupe_key:`award-created:${awardId}`})});
    if (awardId && award.supplier_name) {
      await supabaseRest(`award_suppliers?award_id=eq.${awardId}`, { method: "DELETE" });
      await supabaseRest("award_suppliers", { method: "POST", body: JSON.stringify({ award_id: awardId, supplier_name: award.supplier_name, country_code: award.supplier_country?.length === 2 ? award.supplier_country.toUpperCase() : null, awarded_value: award.value, metadata: { supplier_country: award.supplier_country, source: "World Bank Group" } }) });
    }
    imported += 1;
  }
  return { awards: imported };
}
