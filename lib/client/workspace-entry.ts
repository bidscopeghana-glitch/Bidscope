import { customerReturnPath } from "@/lib/auth-return";

export async function resolveWorkspaceEntry(
  accessToken: string,
  options: { requestedPath?: string; intendedMode?: "buyer" | "supplier" | null } = {},
) {
  const query = new URLSearchParams();
  if (options.requestedPath) query.set("next", customerReturnPath(options.requestedPath));
  if (options.intendedMode) query.set("intendedMode", options.intendedMode);
  try {
    const response = await fetch(`/api/auth/workspace?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json() as { data?: { destination?: string } };
    if (response.ok && result.data?.destination) return result.data.destination;
  } catch {
    // Use the account choice as a safe routing fallback if profile resolution is unavailable.
  }
  if (options.intendedMode === "buyer") return "/procurement/onboarding";
  return customerReturnPath(options.requestedPath);
}
