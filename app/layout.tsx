import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { CookieConsent } from "@/components/legal/cookie-consent";
import {SeoAnalytics} from "@/components/seo/seo-analytics";
import {SeoAttribution} from "@/components/seo/seo-attribution";
import {DEFAULT_OG_IMAGE,SITE_URL} from "@/lib/seo/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "BidScope",
  title: "BidScope | Tenders, Procurement & Contract Opportunities in Ghana",
  description: "Find tenders and contract opportunities in Ghana, receive matched alerts, evaluate requirements and manage procurement workflows for buyers and suppliers.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "BidScope Ghana",
    title: "BidScope | Tenders, Procurement & Contract Opportunities in Ghana",
    description: "Find tenders and contract opportunities in Ghana and manage procurement workflows for buyers and suppliers.",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "BidScope procurement intelligence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BidScope | Tenders, Procurement & Contract Opportunities in Ghana",
    description: "Find tenders and contract opportunities in Ghana and manage procurement workflows for buyers and suppliers.",
    images: [DEFAULT_OG_IMAGE],
  },
  verification:process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?{google:process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}:undefined,
  icons: {
    icon: [
      { url: "/brand/icons/favicon.ico" },
      { url: "/brand/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/icons/favicon-64x64.png", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/brand/icons/favicon.ico",
    apple: [{ url: "/brand/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#084D33",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<CookieConsent /><SeoAnalytics/><Suspense fallback={null}><SeoAttribution/></Suspense></body></html>;
}
