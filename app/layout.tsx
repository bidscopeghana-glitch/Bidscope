import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BidScope Ghana | See opportunity sooner",
  description: "Public opportunity discovery for ambitious Ghanaian businesses.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
