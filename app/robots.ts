import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/auth/", "/customer/", "/notifications/", "/profile/", "/settings/", "/workspace/"],
    },
    sitemap: "https://www.bidscopeghana.com/sitemap.xml",
  };
}
