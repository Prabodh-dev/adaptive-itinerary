import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Adaptive Itinerary",
  description: "Smart itinerary planner",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
      </head>
      <body className={`${sans.variable} ${display.variable} min-h-screen antialiased`}>
        <div className="app-shell">
          <header className="mx-auto mb-4 max-w-7xl">
            <nav className="glass-card nav-shell">
              <Link href="/" className="nav-brand">
                Adaptive Itinerary
              </Link>
              <div className="nav-links">
                <Link href="/" className="nav-link">
                  Planner
                </Link>
                <Link href="/contributor/report" className="nav-link">
                  Contributor
                </Link>
                <Link href="/admin/reports" className="nav-link">
                  Admin Review
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
