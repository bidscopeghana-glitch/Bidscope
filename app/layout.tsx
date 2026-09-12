import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bidscopeghana.com"),
  applicationName: "BidScope",
  title: "BidScope Ghana | Where Opportunity Finds You",
  description: "Discover Ghanaian government and public-sector opportunities in one place.",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "BidScope Ghana",
    title: "BidScope Ghana | Where Opportunity Finds You",
    description: "Discover government and public-sector opportunities in one place.",
    images: [{ url: "/brand/social/bidscope-og.png", width: 1200, height: 630, alt: "BidScope — Where Opportunity Finds You" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BidScope Ghana | Where Opportunity Finds You",
    description: "Discover government and public-sector opportunities in one place.",
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
  return <html lang="en"><body>{children}</body></html>;
}
