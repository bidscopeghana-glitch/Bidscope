export function pagination(searchParams: URLSearchParams, maximum = 50) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(maximum, Math.max(1, Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function totalFromContentRange(value: string | null) {
  const total = value?.split("/")[1];
  return total && total !== "*" ? Number.parseInt(total, 10) : null;
}

export function safeSearchTerm(value: string | null, maximum = 100) {
  return (value || "").trim().slice(0, maximum).replace(/[%_*,()]/g, " ").replace(/\s+/g, " ");
}

