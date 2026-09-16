import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CookieConsent } from "@/components/legal/cookie-consent";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bidscopeghana.com"),
  applicationName: "BidScope",
  title: "BidScope | Procurement Intelligence for Ghana & Beyond",
  description: "Discover public-sector and development-funded procurement opportunities, research buyers and past awards, track opportunities and prepare your business with BidScope.",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "BidScope Ghana",
    title: "BidScope | Procurement Intelligence for Ghana & Beyond",
    description: "Discover public-sector and development-funded procurement opportunities, research buyers and past awards, track opportunities and prepare your business with BidScope.",
    images: [{ url: "/brand/social/bidscope-og.png", width: 1200, height: 630, alt: "BidScope — Where Opportunity Finds You" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BidScope | Procurement Intelligence for Ghana & Beyond",
    description: "Discover public-sector and development-funded procurement opportunities, research buyers and past awards, track opportunities and prepare your business with BidScope.",
    images: ["/brand/social/bidscope-og.png"],
  },
  other: { "codex-preview": "development" },
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
  return <html lang="en"><body>{children}<CookieConsent /></body></html>;
}
