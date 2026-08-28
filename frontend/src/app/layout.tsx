import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TasteProvider } from "@/lib/taste-context";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Letterboxd Movie Matcher",
  description:
    "Connect your Letterboxd profile to scout and match with film lovers in your area based on shared movie tastes.",
  referrer: "no-referrer",
  keywords: ["Letterboxd", "Movie Match", "Taste Matcher", "Film Community", "Soulmates"],
  authors: [{ name: "Ates" }],
  openGraph: {
    title: "Letterboxd Movie Matcher",
    description:
      "Connect your Letterboxd profile to scout and match with film lovers in your area based on shared movie tastes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} min-h-screen flex flex-col justify-between selection:bg-brand-green selection:text-black font-sans antialiased`}
      >
        <TasteProvider>
          <Navbar />
          <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
            {children}
          </main>
          <Footer />
        </TasteProvider>
      </body>
    </html>
  );
}
