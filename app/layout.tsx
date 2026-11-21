import type { Metadata } from "next";
import { Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GRIDFALL — The World That Runs On Nothing",
  description: "A pixel city of autonomous agents, computed from the clock. No server. Every visitor sees the same world, to the pixel.",
  metadataBase: new URL("https://www.gridfall.xyz"),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  openGraph: {
    title: "GRIDFALL — The World That Runs On Nothing",
    description: "A pixel city of autonomous agents, computed from the clock. No server. Every visitor sees the same world, to the pixel.",
    url: "https://www.gridfall.xyz",
    siteName: "GRIDFALL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GRIDFALL — The World That Runs On Nothing",
    description: "A pixel city of autonomous agents, computed from the clock. No server. Every visitor sees the same world, to the pixel.",
    site: "@gridfall_IA",
  },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0a0f" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceMono.variable} ${dmSans.variable} antialiased bg-background text-foreground min-h-screen`} style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
