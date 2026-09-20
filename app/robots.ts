import type { MetadataRoute } from "next";
import {SITE_URL} from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/auth/", "/customer/", "/procurement/", "/meetings/", "/notifications/", "/profile/", "/settings/", "/workspace/", "/services/requests", "/unsubscribe/", "/*?*sort=", "/*?*q=", "/*?*buyer=", "/*?*closing="],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host:SITE_URL,
  };
}
