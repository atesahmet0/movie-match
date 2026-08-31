import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Newsreader, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TasteProvider } from "@/lib/taste-context";
import { QueryProvider } from "@/lib/query-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "oklch(20% 0.016 75)",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "MovieMatch — Cinema Taste & Location Matching",
  description:
    "Match with cinephiles in your city based on your favorite movies and shared cinema taste.",
  referrer: "no-referrer",
  keywords: ["Movie Match", "Taste Matcher", "Film Community", "Cinephiles", "Cinema", "Movies"],
  authors: [{ name: "Ates" }],
  openGraph: {
    title: "MovieMatch — Cinema Taste & Location Matching",
    description:
      "Match with cinephiles in your city based on your favorite movies and shared cinema taste.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body
        className={`${outfit.variable} ${newsreader.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <PostHogProvider>
          <QueryProvider>
            <TasteProvider>
              <div className="app-shell">
                <Navbar />
                <main className="page-frame flex-1">{children}</main>
                <Footer />
              </div>
            </TasteProvider>
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}

