type DeadlineItem = { status: string; opportunity?: { deadline_at?: string | null } | null };
type AttentionItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  related_url: string | null;
  read_at: string | null;
};

const completedBidStatuses = new Set(["SUBMITTED", "AWARDED", "UNSUCCESSFUL", "WITHDRAWN"]);

export function futureDeadlineItems<T extends DeadlineItem>(items: T[], now = Date.now()) {
  return items
    .filter((item) => {
      const deadline = item.opportunity?.deadline_at;
      return Boolean(deadline)
        && !completedBidStatuses.has(item.status)
        && Number.isFinite(Date.parse(deadline!))
        && Date.parse(deadline!) > now;
    })
    .sort((a, b) => Date.parse(a.opportunity!.deadline_at!) - Date.parse(b.opportunity!.deadline_at!));
}

export function uniqueAttentionItems<T extends AttentionItem>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.read_at || !["urgent", "high"].includes(item.priority)) return false;
    const key = [item.type, item.title.trim(), item.message.trim(), item.related_url || ""].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
