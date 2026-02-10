import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StageHand",
  description: "Real-time stage management system for OBS overlays",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
