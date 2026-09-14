import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const scriptSrc = [`'self'`, `'unsafe-inline'`, "https://js.paystack.co", ...(isDevelopment ? [`'unsafe-eval'`] : [])].join(" ");
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: [`default-src 'self'`, `script-src ${scriptSrc}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", "connect-src 'self' https://*.supabase.co https://api.paystack.co", "frame-src https://checkout.paystack.com https://js.paystack.co", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self' https://checkout.paystack.com", "object-src 'none'", "upgrade-insecure-requests"].join("; ") },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
