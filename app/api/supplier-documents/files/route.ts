import { randomUUID } from "node:crypto";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { supabaseConfiguration, supabaseRest } from "@/lib/server/supabase-rest";
import { DOCUMENT_CATEGORIES, dateOnlyTime, isOrganizationDocumentPath } from "@/lib/document-passport";
import { documentRisk, sha256 } from "@/lib/server/supplier-verification-policy";

export const dynamic = "force-dynamic";
const bucket = "supplier-documents-private";
const allowed = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "image/png", "image/jpeg"]);
const categories = new Set(Object.keys(DOCUMENT_CATEGORIES));
type Doc = { id: string; organization_id: string; uploaded_by: string; title: string; storage_path: string | null; metadata: Record<string, unknown> };
async function documentFor(userId: string, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError(400, "Invalid document ID.", "invalid_document_id");
  const { data } = await supabaseRest<Doc[]>(`supplier_documents?select=id,organization_id,uploaded_by,title,storage_path,metadata&id=eq.${id}&limit=1`);
  if (!data[0]) throw new ApiError(404, "Document not found.", "document_not_found");
  const membership = await requireOrganizationMember(userId, data[0].organization_id);
  if (data[0].storage_path && !isOrganizationDocumentPath(data[0].storage_path, data[0].organization_id)) throw new ApiError(403, "This file does not belong to this document workspace.", "document_storage_scope_denied");
  return { doc: data[0], membership };
}
function storage(path: string) {
  const { url, serviceKey } = supabaseConfiguration();
  if (!serviceKey) throw new ApiError(503, "Private document storage is unavailable.", "storage_unavailable");
  return { url: `${url}/storage/v1/object/${bucket}/${path}`, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } };
}
export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const form = await request.formData();
    const organizationId = String(form.get("organizationId") || "");
    await requireOrganizationMember(user.id, organizationId);
    const file = form.get("file");
    if (!(file instanceof File) || !allowed.has(file.type) || file.size < 1 || file.size > 4 * 1024 * 1024) throw new ApiError(400, "Choose a PDF, Word, Excel, CSV, PNG or JPEG file under 4 MB.", "invalid_document_file");
    const title = String(form.get("title") || file.name).trim().slice(0, 200);
    if (!title) throw new ApiError(400, "Document title is required.", "document_title_required");
    const documentType = String(form.get("documentType") || "other");
    if (!categories.has(documentType)) throw new ApiError(400, "Choose a valid document category.", "invalid_document_category");
    const expiresAt = String(form.get("expiresAt") || "");
    const issuedAt = String(form.get("issuedAt") || "");
    const issuingAuthority = String(form.get("issuingAuthority") || "").trim();
    if (issuingAuthority.length > 200) throw new ApiError(400, "Issuing authority must be under 200 characters.", "invalid_issuing_authority");
    if ((expiresAt && dateOnlyTime(expiresAt) === null) || (issuedAt && dateOnlyTime(issuedAt) === null)) throw new ApiError(400, "Choose valid issue and expiry dates.", "invalid_document_date");
    if (issuedAt && expiresAt && issuedAt > expiresAt) throw new ApiError(400, "Issue date must not be after expiry date.", "invalid_document_dates");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (documentRisk(bytes, file.type, false).flags.includes("file_signature_mismatch")) throw new ApiError(400, "The file contents do not match the selected file type.", "invalid_document_signature");
    const id = randomUUID(), path = `${organizationId}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120)}`;
    const object = storage(path);
    const stored = await fetch(object.url, { method: "POST", headers: { ...object.headers, "Content-Type": file.type, "x-upsert": "false" }, body: bytes });
    if (!stored.ok) throw new ApiError(503, "The private document could not be stored.", "storage_upload_failed");
    try {
      const { data } = await supabaseRest<Doc[]>("supplier_documents", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id, organization_id: organizationId, uploaded_by: user.id, document_type: documentType, title, storage_path: path, issued_at: issuedAt || null, expires_at: expiresAt || null, metadata: { original_filename: file.name.slice(0, 180), mime_type: file.type, size_bytes: file.size, sha256: sha256(bytes), issuing_authority: issuingAuthority || null, privacy_level: "organisation", version: 1 } }) });
      return Response.json({ data: data[0] }, { status: 201 });
    } catch (error) {
      await fetch(object.url, { method: "DELETE", headers: object.headers });
      throw error;
    }
  } catch (error) { return apiErrorResponse(error); }
}
export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const { doc } = await documentFor(user.id, params.get("id") || "");
    if (!doc.storage_path) throw new ApiError(404, "No file is attached to this record.", "document_missing");
    const object = storage(doc.storage_path);
    const response = await fetch(object.url, { headers: object.headers, cache: "no-store" });
    if (!response.ok) throw new ApiError(404, "The private file is unavailable.", "document_missing");
    return new Response(response.body, { headers: { "Content-Type": String(doc.metadata?.mime_type || "application/octet-stream"), "Content-Disposition": `${params.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(String(doc.metadata?.original_filename || doc.title))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return apiErrorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = await request.json() as { id?: string; title?: string };
    const { doc, membership } = await documentFor(user.id, body.id || "");
    if (doc.uploaded_by !== user.id && !["owner", "admin"].includes(membership.role)) throw new ApiError(403, "You cannot rename this document.", "document_manage_denied");
    const title = String(body.title || "").trim();
    if (!title || title.length > 200) throw new ApiError(400, "Enter a document title up to 200 characters.", "invalid_document_title");
    await supabaseRest(`supplier_documents?id=eq.${doc.id}`, { method: "PATCH", body: JSON.stringify({ title }) });
    return Response.json({ data: { id: doc.id, title } });
  } catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser(request);
    const { doc, membership } = await documentFor(user.id, new URL(request.url).searchParams.get("id") || "");
    if (doc.uploaded_by !== user.id && !["owner", "admin"].includes(membership.role)) throw new ApiError(403, "You cannot delete this document.", "document_manage_denied");
    if (doc.storage_path) {
      const object = storage(doc.storage_path);
      const backup = await fetch(object.url, { headers: object.headers, cache: "no-store" });
      const bytes = backup.ok ? new Uint8Array(await backup.arrayBuffer()) : null;
      const removed = await fetch(object.url, { method: "DELETE", headers: object.headers });
      if (!removed.ok && removed.status !== 404) throw new ApiError(503, "The stored file could not be removed; the record was kept.", "storage_delete_failed");
      try {
        await supabaseRest(`supplier_documents?id=eq.${doc.id}&organization_id=eq.${doc.organization_id}`, { method: "DELETE" });
      } catch (error) {
        if (bytes) await fetch(object.url, { method: "POST", headers: { ...object.headers, "Content-Type": String(doc.metadata?.mime_type || "application/octet-stream"), "x-upsert": "false" }, body: bytes });
        throw error;
      }
    } else {
      await supabaseRest(`supplier_documents?id=eq.${doc.id}&organization_id=eq.${doc.organization_id}`, { method: "DELETE" });
    }
    return new Response(null, { status: 204 });
  } catch (error) { return apiErrorResponse(error); }
}
