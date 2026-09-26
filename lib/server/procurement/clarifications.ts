type ClarificationRecord = Record<string, unknown>;

export function supplierClarificationView(item: ClarificationRecord) {
  const shared = item.visibility === "all_participants" || item.visibility === "public";
  return {
    id: item.id,
    tender_id: item.tender_id,
    kind: item.kind,
    subject: item.subject,
    message: item.message,
    status: item.status,
    visibility: item.visibility,
    created_at: item.created_at,
    response_to_id: shared ? null : item.response_to_id,
  };
}
