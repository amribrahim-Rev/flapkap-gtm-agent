import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlapKap GTM Agent",
  description: "AI-powered cold email campaign builder for FlapKap BDRs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
