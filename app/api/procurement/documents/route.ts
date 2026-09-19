import { randomUUID } from "node:crypto";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import {
  procurementContext,
  requireTenderManager,
  tenderById,
} from "@/lib/server/procurement/access";
import {
  supabaseConfiguration,
  supabaseRest,
} from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const bucket = "procurement-private",
  max = 25 * 1024 * 1024,
  allowed = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
  ]);
async function store(path: string, file: File) {
  const { url, serviceKey } = supabaseConfiguration();
  if (!serviceKey)
    throw new ApiError(
      503,
      "Private document storage is not configured.",
      "storage_unavailable",
    );
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: new Uint8Array(await file.arrayBuffer()),
  });
  if (!response.ok)
    throw new ApiError(
      503,
      "The private document could not be stored.",
      "storage_upload_failed",
    );
}
export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request),
      context = await procurementContext(user),
      form = await request.formData(),
      file = form.get("file"),
      kind = String(form.get("kind") || ""),
      entityId = String(form.get("entityId") || "");
    if (!(file instanceof File))
      throw new ApiError(400, "Choose a document to upload.", "missing_file");
    if (!allowed.has(file.type))
      throw new ApiError(
        400,
        "Only PDF, Word, Excel, PNG and JPEG documents are accepted.",
        "invalid_file_type",
      );
    if (file.size < 1 || file.size > max)
      throw new ApiError(
        413,
        "Documents must be 25 MB or smaller.",
        "file_too_large",
      );
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120),
      id = randomUUID();
    if (kind === "tender") {
      const { tender } = await requireTenderManager(user, entityId);
      const path = `tenders/${tender.id}/${id}-${safe}`;
      await store(path, file);
      await supabaseRest("procurement_tender_documents", {
        method: "POST",
        body: JSON.stringify({
          id,
          tender_id: tender.id,
          uploaded_by: user.id,
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          visibility: String(form.get("visibility") || "eligible_suppliers"),
        }),
      });
      return Response.json({ data: { id, name: file.name } }, { status: 201 });
    }
    if (kind === "bid") {
      const { data: bids } = await supabaseRest<
          Array<{
            id: string;
            tender_id: string;
            supplier_organization_id: string;
            status: string;
          }>
        >(
          `supplier_bids?select=id,tender_id,supplier_organization_id,status&id=eq.${entityId}&limit=1`,
        ),
        bid = bids[0];
      if (!bid || bid.supplier_organization_id !== context.organizationId)
        throw new ApiError(404, "Bid not found.", "bid_not_found");
      const tender = await tenderById(bid.tender_id);
      if (
        !["draft", "submitted"].includes(bid.status) ||
        Date.now() >= Date.parse(tender.submission_deadline)
      )
        throw new ApiError(
          409,
          "Documents can no longer be added to this bid.",
          "bid_locked",
        );
      const requiredDocumentId = String(form.get("requiredDocumentId") || "");
      if (requiredDocumentId) {
        const { data: requirements } = await supabaseRest<
          Array<{ accepted_mime_types: string[] }>
        >(
          `procurement_required_documents?select=accepted_mime_types&id=eq.${requiredDocumentId}&tender_id=eq.${tender.id}&limit=1`,
        );
        if (!requirements.length)
          throw new ApiError(
            400,
            "This document requirement does not belong to the tender.",
            "invalid_document_requirement",
          );
        if (
          requirements[0].accepted_mime_types.length &&
          !requirements[0].accepted_mime_types.includes(file.type)
        )
          throw new ApiError(
            400,
            "The selected file type is not accepted for this requirement.",
            "document_type_not_accepted",
          );
      }
      const path = `bids/${bid.id}/${id}-${safe}`;
      await store(path, file);
      await supabaseRest("supplier_bid_documents", {
        method: "POST",
        body: JSON.stringify({
          id,
          bid_id: bid.id,
          required_document_id: requiredDocumentId || null,
          uploaded_by: user.id,
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      });
      return Response.json({ data: { id, name: file.name } }, { status: 201 });
    }
    throw new ApiError(
      400,
      "Choose a tender or bid document destination.",
      "invalid_document_kind",
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request),
      params = new URL(request.url).searchParams,
      kind = params.get("kind"),
      id = params.get("id");
    if (!id || !kind)
      throw new ApiError(
        400,
        "Document reference is required.",
        "missing_document",
      );
    let path = "",
      name = "",
      mime = "application/octet-stream";
    if (kind === "tender") {
      const { data } = await supabaseRest<
          Array<{
            tender_id: string;
            storage_path: string;
            original_filename: string;
            mime_type: string;
            visibility: string;
          }>
        >(`procurement_tender_documents?select=*&id=eq.${id}&limit=1`),
        doc = data[0];
      if (!doc)
        throw new ApiError(404, "Document not found.", "document_not_found");
      const tender = await tenderById(doc.tender_id),
        context = await procurementContext(user);
      const isBuyer = tender.organization_id === context.organizationId;
      if (doc.visibility === "buyer_team")
        await requireTenderManager(user, tender.id);
      else if (!isBuyer && doc.visibility === "bidders") {
        const { data: bid } = await supabaseRest<unknown[]>(
          `supplier_bids?select=id&tender_id=eq.${tender.id}&supplier_organization_id=eq.${context.organizationId}&status=neq.draft&limit=1`,
        );
        if (!bid.length)
          throw new ApiError(
            403,
            "This document is available only to submitted bidders.",
            "document_forbidden",
          );
      } else if (tender.visibility === "invite_only" && !isBuyer) {
        const { data: invite } = await supabaseRest<unknown[]>(
          `tender_invitations?select=id&tender_id=eq.${tender.id}&supplier_organization_id=eq.${context.organizationId}&limit=1`,
        );
        if (!invite.length)
          throw new ApiError(
            403,
            "You are not authorised to access this document.",
            "document_forbidden",
          );
      }
      path = doc.storage_path;
      name = doc.original_filename;
      mime = doc.mime_type;
    } else {
      const { data } = await supabaseRest<
          Array<{
            bid_id: string;
            storage_path: string;
            original_filename: string;
            mime_type: string;
          }>
        >(`supplier_bid_documents?select=*&id=eq.${id}&limit=1`),
        doc = data[0];
      if (!doc)
        throw new ApiError(404, "Document not found.", "document_not_found");
      const { data: bids } = await supabaseRest<
          Array<{ tender_id: string; supplier_organization_id: string }>
        >(
          `supplier_bids?select=tender_id,supplier_organization_id&id=eq.${doc.bid_id}&limit=1`,
        ),
        bid = bids[0],
        context = await procurementContext(user);
      if (!bid) throw new ApiError(404, "Bid not found.", "bid_not_found");
      if (bid.supplier_organization_id !== context.organizationId)
        await requireTenderManager(user, bid.tender_id);
      path = doc.storage_path;
      name = doc.original_filename;
      mime = doc.mime_type;
    }
    const { url, serviceKey } = supabaseConfiguration();
    if (!serviceKey)
      throw new ApiError(
        503,
        "Private document storage is not configured.",
        "storage_unavailable",
      );
    const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: "no-store",
    });
    if (!response.ok)
      throw new ApiError(
        404,
        "The private document is unavailable.",
        "document_missing",
      );
    return new Response(response.body, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
