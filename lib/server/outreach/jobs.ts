import { analyseRows, parseProspectFile } from "./importer";
import { downloadOutreachFile } from "./storage";
import { supabaseRest, encodeFilter } from "../supabase-rest";

type ImportJob = {
  id: string;
  storage_path: string;
  file_type: "csv" | "xlsx" | "xls";
  status: string;
  column_mapping: Record<string, string>;
  uploaded_by: string;
};
async function patchImport(id: string, body: Record<string, unknown>) {
  await supabaseRest(`prospect_imports?id=eq.${encodeFilter(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
async function chunks<T>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += size)
    await fn(items.slice(i, i + size));
}

async function analyse(job: ImportJob) {
  await patchImport(job.id, {
    status: "analysing",
    stage: "reading",
    error_message: null,
  });
  const buffer = await downloadOutreachFile(job.storage_path);
  const parsed = parseProspectFile(buffer, job.file_type);
  await patchImport(job.id, {
    stage: "cleaning",
    total_rows: parsed.rows.length,
    detected_columns: parsed.headers,
  });
  const result = analyseRows(parsed);
  await supabaseRest(
    `prospect_import_rows?import_id=eq.${encodeFilter(job.id)}`,
    { method: "DELETE" },
  );
  await chunks(result.staged, 400, async (rows) => {
    await supabaseRest("prospect_import_rows", {
      method: "POST",
      body: JSON.stringify(
        rows.map((row) => ({
          import_id: job.id,
          row_number: row.rowNumber,
          raw_data: row.raw,
          cleaned_data: row.cleaned,
          status: row.status,
          rejection_reasons: row.reasons,
          classification: row.classification,
          fit_score: row.fit.score,
        })),
      ),
    });
  });
  await patchImport(job.id, {
    status: "mapping_required",
    stage: "awaiting_approval",
    column_mapping: result.mapping,
    summary: result.summary,
    rejected_rows: result.staged.filter((x) => x.status === "rejected").length,
    processed_rows: result.staged.length,
  });
  return { jobId: job.id, action: "analysed", rows: result.staged.length };
}

async function importApproved(job: ImportJob) {
  await patchImport(job.id, {
    status: "processing",
    stage: "cleaning",
    error_message: null,
  });
  const buffer = await downloadOutreachFile(job.storage_path);
  const parsed = parseProspectFile(buffer, job.file_type);
  const result = analyseRows(parsed, job.column_mapping);
  await patchImport(job.id, { stage: "deduplicating" });
  const grouped = new Map<string, (typeof result.staged)[number]>();
  let duplicates = 0;
  for (const row of result.staged) {
    if (row.status === "rejected") continue;
    const key = String(
      row.cleaned.normalized_email ||
        `${row.cleaned.normalized_company_name}|${row.cleaned.country_code || ""}`,
    );
    const previous = grouped.get(key);
    if (!previous) {
      grouped.set(key, row);
      continue;
    }
    duplicates++;
    previous.cleaned.tender_activity_count =
      Number(previous.cleaned.tender_activity_count || 0) +
      Number(row.cleaned.tender_activity_count || 0);
    previous.cleaned.award_count =
      Number(previous.cleaned.award_count || 0) +
      Number(row.cleaned.award_count || 0);
    previous.cleaned.raw_source_data = {
      aggregatedRows: [previous.rowNumber, row.rowNumber],
    };
  }
  await patchImport(job.id, {
    stage: "classifying",
    duplicate_rows: duplicates,
  });
  const accepted: Array<Record<string, unknown>> = [...grouped.values()].map(
    (row) => ({
      ...row.cleaned,
      award_count: Number(row.cleaned.award_count || 0),
      source_file_id: job.id,
      source_row_number: row.rowNumber,
      source: String(row.cleaned.source || "File import"),
      raw_source_data: row.raw,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  );
  const withEmail = accepted.filter((row) => row.normalized_email),
    withoutEmail = accepted.filter((row) => !row.normalized_email);
  await patchImport(job.id, { stage: "scoring" });
  const existingByEmail = new Map<string, Record<string, unknown>>();
  await chunks(withEmail, 150, async (rows) => {
    const emails = rows
      .map((row) => String(row.normalized_email))
      .filter(Boolean)
      .map((value) => `"${value.replaceAll('"', "")}"`)
      .join(",");
    if (!emails) return;
    const { data: existing } = await supabaseRest<
      Array<Record<string, unknown>>
    >(
      `prospects?normalized_email=in.(${encodeURIComponent(emails)})&select=*`,
    );
    for (const item of existing)
      existingByEmail.set(String(item.normalized_email), item);
  });
  for (let index = 0; index < withEmail.length; index++) {
    const incoming = withEmail[index];
    const existing = existingByEmail.get(String(incoming.normalized_email));
    if (!existing) continue;
    withEmail[index] = {
      ...existing,
      ...Object.fromEntries(
        Object.entries(incoming).filter(
          ([, value]) => value !== null && value !== undefined && value !== "",
        ),
      ),
      id: existing.id,
      tender_activity_count: Math.max(
        Number(existing.tender_activity_count || 0),
        Number(incoming.tender_activity_count || 0),
      ),
      award_count: Math.max(
        Number(existing.award_count || 0),
        Number(incoming.award_count || 0),
      ),
      source_file_id: job.id,
      source_row_number: incoming.source_row_number,
      updated_at: new Date().toISOString(),
    };
  }
  await chunks(withEmail, 250, async (rows) => {
    await supabaseRest("prospects?on_conflict=normalized_email", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  });
  for (const row of withoutEmail) {
    const company = encodeFilter(String(row.normalized_company_name || ""));
    const country = row.country_code ? `eq.${encodeFilter(String(row.country_code))}` : "is.null";
    const { data: existing } = await supabaseRest<Array<{ id: string }>>(
      `prospects?normalized_email=is.null&normalized_company_name=eq.${company}&country_code=${country}&select=id&limit=1`,
    );
    if (existing[0]) await supabaseRest(`prospects?id=eq.${encodeFilter(existing[0].id)}`, { method: "PATCH", body: JSON.stringify(row) });
    else await supabaseRest("prospects", { method: "POST", body: JSON.stringify(row) });
  }
  const prospects: Array<{
      id: string;
      company_name: string;
      industry: string | null;
      country_code: string | null;
      source_row_number: number;
      tender_activity_count: number;
      award_count: number;
    }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: page } = await supabaseRest<typeof prospects>(
      `prospects?source_file_id=eq.${encodeFilter(job.id)}&select=id,company_name,industry,country_code,source_row_number,tender_activity_count,award_count&order=source_row_number.asc&limit=1000&offset=${offset}`,
    );
    prospects.push(...page);
    if (page.length < 1000) break;
  }
  const rawByRow = new Map(result.staged.map((row) => [row.rowNumber, row.raw]));
  await chunks(prospects, 400, async (rows) => {
    await supabaseRest(
      "prospect_source_records?on_conflict=import_id,source_row_number",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify(
          rows.map((row) => ({
            prospect_id: row.id,
            import_id: job.id,
            source_row_number: row.source_row_number,
            source_name: "File import",
            raw_data: rawByRow.get(row.source_row_number) || {},
            tender_activity_count: row.tender_activity_count,
            award_count: row.award_count,
          })),
        ),
      },
    );
  });
  const ambiguous=prospects.filter(prospect=>!prospect.industry||prospect.industry==="Other");
  await chunks(ambiguous,25,async rows=>{await supabaseRest("ai_jobs",{method:"POST",body:JSON.stringify({task_type:"company_classification",user_id:job.uploaded_by,priority:150,status:"queued",next_attempt_at:new Date().toISOString(),payload:{prospectIds:rows.map(row=>row.id),sourceImportId:job.id}})});});
  const segmentGroups = new Map<string, typeof prospects>();
  for (const prospect of prospects) {
    const key = `${prospect.country_code || "Global"}|${prospect.industry || "Other"}`;
    const list = segmentGroups.get(key) || [];
    list.push(prospect);
    segmentGroups.set(key, list);
  }
  for (const [key, members] of segmentGroups) {
    if (members.length < 2) continue;
    const [country, industry] = key.split("|");
    const name = `${country} ${industry}`;
    const query = new URLSearchParams({ select: "id", name: `eq.${name}`, order: "created_at.desc", limit: "1" });
    const { data: existingSegments } = await supabaseRest<Array<{ id: string }>>(`prospect_segments?${query}`);
    let segmentId = existingSegments[0]?.id;
    const segmentBody = {
      name,
      description: `Suggested automatically from the approved import.`,
      country_code: country === "Global" ? null : country,
      filter_definition: { country_code: country, industry },
      source_import_id: job.id,
      created_by: job.uploaded_by,
    };
    if (segmentId) {
      await supabaseRest(`prospect_segments?id=eq.${encodeFilter(segmentId)}`, { method: "PATCH", body: JSON.stringify(segmentBody) });
      await supabaseRest(`prospect_segment_members?segment_id=eq.${encodeFilter(segmentId)}`, { method: "DELETE" });
    } else {
      const { data: segment } = await supabaseRest<Array<{ id: string }>>("prospect_segments", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(segmentBody),
      });
      segmentId = segment[0]?.id;
    }
    if (segmentId)
      await chunks(members, 500, async (part) => {
        await supabaseRest("prospect_segment_members", {
          method: "POST",
          body: JSON.stringify(
            part.map((x) => ({ segment_id: segmentId, prospect_id: x.id })),
          ),
        });
      });
  }
  const rejected = result.staged.filter((x) => x.status === "rejected").length;
  await patchImport(job.id, {
    status: "complete",
    stage: "complete",
    accepted_rows: accepted.length,
    rejected_rows: rejected,
    duplicate_rows: duplicates,
    processed_rows: result.staged.length,
    completed_at: new Date().toISOString(),
    summary: {
      ...result.summary,
      newProspects: prospects.length,
      segmentsCreated: segmentGroups.size,
      aiClassificationQueued: ambiguous.length,
    },
  });
  await supabaseRest("audit_log", {
    method: "POST",
    body: JSON.stringify({
      actor_user_id: job.uploaded_by,
      action: "outreach.import.completed",
      entity_type: "prospect_import",
      entity_id: job.id,
      metadata: { accepted: accepted.length, rejected, duplicates },
    }),
  });
  return { jobId: job.id, action: "imported", rows: accepted.length };
}

export async function processNextOutreachImport() {
  const { data } = await supabaseRest<ImportJob[]>(
    "prospect_imports?status=in.(uploaded,approved)&select=id,storage_path,file_type,status,column_mapping,uploaded_by&order=created_at&limit=1",
  );
  const job = data[0];
  if (!job) return { action: "idle" };
  try {
    return job.status === "uploaded"
      ? await analyse(job)
      : await importApproved(job);
  } catch (error) {
    await patchImport(job.id, {
      status: "failed",
      stage: "failed",
      error_message:
        error instanceof Error ? error.message : "Unexpected import failure",
    });
    throw error;
  }
}
