import type { MetadataRoute } from "next";

const baseUrl = "https://www.bidscopeghana.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/opportunities", "/plans", "/pricing", "/sign-in", "/privacy", "/terms", "/cookies"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/opportunities" ? "daily" as const : "weekly" as const,
    priority: path === "" ? 1 : path === "/opportunities" ? 0.9 : 0.6,
  }));
}
