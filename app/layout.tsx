import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Canvas — Architecture Studio",
  description: "Map, inspect, and ship your cloud architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
