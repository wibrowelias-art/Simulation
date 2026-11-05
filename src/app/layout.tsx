import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lanternfish",
  description: "A wallet, paper trading on real market prices, a group chat and a social feed, in one fictional world. Money is virtual; people are invented.",
  applicationName: "Lanternfish",
  appleWebApp: { capable: true, title: "Lanternfish", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

// resizes-content: the on-screen keyboard shrinks the layout instead of covering the composer
export const viewport: Viewport = { themeColor: "#0b0c0e", width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="midnight" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
