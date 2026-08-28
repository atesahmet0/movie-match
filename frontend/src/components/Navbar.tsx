"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Sparkles, Search, Clock, X, Film } from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { motion } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedFilms, activeUsername, setActiveUsername } = useTaste();

  const handleLogout = () => {
    setActiveUsername("");
    router.push("/");
  };

  const navItems = [
    {
      href: activeUsername ? `/?user=${encodeURIComponent(activeUsername)}` : "/",
      label: "My Profile",
      fullLabel: "My Profile & Films",
      icon: User,
      isActive: pathname === "/",
    },
    {
      href: "/taste",
      label: "Soulmates",
      fullLabel: "Taste Soulmates",
      icon: Sparkles,
      isActive: pathname.startsWith("/taste"),
      badgeCount: selectedFilms.length,
    },
    {
      href: "/scout",
      label: "Scout",
      fullLabel: "Scout Any Film",
      icon: Search,
      isActive: pathname.startsWith("/scout"),
    },
    {
      href: "/history",
      label: "Logs",
      fullLabel: "History",
      icon: Clock,
      isActive: pathname.startsWith("/history"),
    },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center space-x-3 cursor-pointer select-none group"
        >
          <div className="flex space-x-1.5 items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff8000] group-hover:scale-125 transition-transform"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#00e054] group-hover:scale-125 transition-transform delay-75"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#40bcf4] group-hover:scale-125 transition-transform delay-150"></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
              Movie<span className="text-[#00e054]">Match</span>
            </span>
            <span className="hidden md:inline-block text-[10px] bg-[#1b2228] border border-[#2c3440] text-[#99aabb] font-mono px-2 py-0.5 rounded-full font-semibold">
              Letterboxd
            </span>
          </div>
        </Link>

        {/* Navigation Tabs with Framer Motion Layout Animation */}
        <nav className="flex items-center space-x-1 bg-[#14181c]/80 p-1 rounded-xl border border-[#2c3440] text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors z-10 ${
                  item.isActive
                    ? "text-[#0d1114] font-bold"
                    : "text-[#99aabb] hover:text-white font-medium"
                }`}
              >
                {item.isActive && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 bg-[#00e054] rounded-lg -z-10 shadow-md shadow-[#00e054]/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{item.fullLabel}</span>
                <span className="sm:hidden">{item.label}</span>

                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      item.isActive
                        ? "bg-[#0d1114] text-[#00e054]"
                        : "bg-[#ff8000] text-white"
                    }`}
                  >
                    {item.badgeCount}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Active User Profile Pill in Header */}
        {activeUsername ? (
          <div className="hidden sm:flex items-center">
            <div className="flex items-center space-x-2 bg-[#1b2228] px-3 py-1.5 rounded-xl border border-[#2c3440] hover:border-[#3d4957] transition-colors">
              <div className="w-2 h-2 rounded-full bg-[#00e054] animate-pulse"></div>
              <span className="text-xs font-bold text-white">@{activeUsername}</span>
              <button
                onClick={handleLogout}
                className="text-[#667788] hover:text-[#ff8000] ml-1 p-0.5 transition-colors"
                title="Switch profile"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center">
            <Link
              href="/"
              className="text-xs text-[#99aabb] hover:text-white bg-[#1b2228] border border-[#2c3440] px-3 py-1.5 rounded-xl transition-colors font-medium flex items-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5 text-[#00e054]" />
              Connect Profile
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
