"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Sparkles, Search, Clock, X } from "lucide-react";
import { useTaste } from "@/lib/taste-context";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedFilms, activeUsername, setActiveUsername } = useTaste();

  const handleLogout = () => {
    setActiveUsername("");
    router.push("/");
  };

  return (
    <header className="border-b border-brand-border bg-brand-darker sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 cursor-pointer select-none">
          <div className="flex space-x-1.5 items-center">
            <span className="w-3 h-3 rounded-full bg-brand-orange"></span>
            <span className="w-3 h-3 rounded-full bg-brand-green"></span>
            <span className="w-3 h-3 rounded-full bg-brand-blue"></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
              Movie<span className="text-brand-green">Match</span>
            </span>
            <span className="hidden md:inline-block text-[10px] bg-brand-border text-brand-subtext font-mono px-2 py-0.5 rounded font-semibold">
              Letterboxd Taste Scout
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-brand-card p-1 rounded-xl border border-brand-border text-xs">
          <Link
            href={activeUsername ? `/?user=${encodeURIComponent(activeUsername)}` : "/"}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
              pathname === "/"
                ? "bg-brand-green text-black font-bold"
                : "text-gray-300 hover:text-white hover:bg-brand-cardHover font-medium"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Profile & Films</span>
            <span className="sm:hidden">Profile</span>
          </Link>

          <Link
            href="/taste"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
              pathname.startsWith("/taste")
                ? "bg-brand-green text-black font-bold"
                : "text-gray-300 hover:text-white hover:bg-brand-cardHover font-medium"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Taste Soulmates</span>
            <span className="sm:hidden">Soulmates</span>
            {selectedFilms.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-brand-orange text-black font-bold rounded-full text-[10px]">
                {selectedFilms.length}
              </span>
            )}
          </Link>

          <Link
            href="/scout"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
              pathname.startsWith("/scout")
                ? "bg-brand-green text-black font-bold"
                : "text-gray-300 hover:text-white hover:bg-brand-cardHover font-medium"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scout Any Film</span>
            <span className="sm:hidden">Scout</span>
          </Link>

          <Link
            href="/history"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition duration-150 ${
              pathname.startsWith("/history")
                ? "bg-brand-green text-black font-bold"
                : "text-gray-300 hover:text-white hover:bg-brand-cardHover font-medium"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">History</span>
            <span className="md:hidden">Logs</span>
          </Link>
        </nav>

        {/* Active User Profile Pill in Header */}
        {activeUsername && (
          <div className="hidden sm:flex items-center">
            <div className="flex items-center space-x-2 bg-brand-card px-3 py-1 rounded-xl border border-brand-border">
              <span className="text-xs font-bold text-white">@{activeUsername}</span>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 ml-1 p-0.5 transition"
                title="Switch profile"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
