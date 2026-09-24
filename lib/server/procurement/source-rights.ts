import { ApiError } from "../api-error.ts";
import { canCrawl, canPublish, type SourceRights } from "../discovery/rights.ts";
import type { ProcurementSource } from "./types.ts";

/** The legacy connectors fetch full source content, not factual link previews. */
export function assertLegacySourceRights(source: ProcurementSource & SourceRights) {
  if (source.reuse_status === "official_open_data") {
    throw new ApiError(409, "Use this source's approved structured-data importer.", "source_rights_blocked");
  }
  if (source.reuse_status === "public_link_only" || !canPublish(source) || !source.content_reuse_allowed) {
    throw new ApiError(409, "Source rights do not permit commercial content ingestion. Record permission or a compatible licence first.", "source_rights_blocked");
  }
}

/** Only the approved GHANEPS OCDS importer may use its structured-data licence. */
export function assertApprovedOpenDataRights(source: ProcurementSource & SourceRights) {
  if (source.slug !== "ghaneps" || source.reuse_status !== "official_open_data" || !canPublish(source) || !source.content_reuse_allowed) {
    throw new ApiError(409, "Approved structured-data ingestion requires a current GHANEPS OCDS licence and publication rights.", "source_rights_blocked");
  }
}

/** A reviewed link-only discovery may publish factual metadata, never source prose or files. */
export function assertApprovedLinkOnlyRights(source: ProcurementSource & SourceRights) {
  if (source.reuse_status !== "public_link_only" || !canCrawl(source) || !canPublish(source) ||
      source.content_reuse_allowed || source.document_reuse_allowed) {
    throw new ApiError(409, "Link-only publication requires reviewed factual-metadata rights and an enabled compliant crawler.", "source_rights_blocked");
  }
}
