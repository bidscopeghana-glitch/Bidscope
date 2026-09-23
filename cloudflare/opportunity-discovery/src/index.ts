interface Env { BIDSCOPE_ORIGIN: string; DISCOVERY_WORKER_SECRET: string }

async function tick(env: Env) {
  if (!env.DISCOVERY_WORKER_SECRET) throw new Error("Discovery worker secret is missing.");
  const response = await fetch(`${env.BIDSCOPE_ORIGIN}/api/internal/discovery/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.DISCOVERY_WORKER_SECRET}` },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`BidScope discovery tick returned HTTP ${response.status}`);
  return response.json();
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(tick(env).then(result => { console.log("Discovery tick completed", JSON.stringify(result)); }));
  },
  async fetch(request: Request) {
    if (request.method === "GET" && new URL(request.url).pathname === "/health")
      return Response.json({ service: "bidscope-opportunity-discovery", status: "ready" });
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
