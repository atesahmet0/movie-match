import type { Metadata, Viewport } from "next";
import { Outfit, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TasteProvider } from "@/lib/taste-context";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#14181c",
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
    <html lang="en" className="dark scroll-smooth">
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body
        className={`${outfit.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} min-h-screen flex flex-col justify-between bg-brand-dark text-[#e1e7ed] font-sans antialiased selection:bg-brand-green selection:text-black overflow-x-clip`}
      >
        <TasteProvider>
          <div className="relative min-h-screen flex flex-col justify-between">
            {/* Ambient Background Noise & Subtle Glow */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
              <div className="absolute -top-[30%] left-[10%] w-[600px] h-[600px] rounded-full bg-brand-green/5 blur-[120px]" />
              <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] rounded-full bg-brand-orange/5 blur-[140px]" />
              <div className="absolute bottom-[10%] left-[20%] w-[550px] h-[550px] rounded-full bg-brand-blue/5 blur-[130px]" />
            </div>

            <Navbar />
            <main className="relative z-10 flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
              {children}
            </main>
            <Footer />
          </div>
        </TasteProvider>
      </body>
    </html>
  );
}
