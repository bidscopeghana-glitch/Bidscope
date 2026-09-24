import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password | BidScope",
  description: "Choose a new password for your BidScope account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
