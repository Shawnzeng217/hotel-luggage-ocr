import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hilton Luggage Storage",
  description: "Digital luggage storage management",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
  themeColor: '#002F61',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-[#F0E9E6] font-sans">
        {children}
      </body>
    </html>
  );
}
