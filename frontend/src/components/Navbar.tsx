/* Hallmark · component: Navbar · archetype: N5 Floating Pill + N1b Masthead · theme: Midnight Cinema
 * motion: spring layoutId · badge-pop · tactile-hover
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Sparkles, Search, Clock, X, Film, Menu } from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedFilms, activeUsername, setActiveUsername } = useTaste();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setActiveUsername("");
    router.push("/");
  };

  const navItems = [
    {
      href: "/",
      label: "Match",
      fullLabel: "Movie Match",
      icon: Sparkles,
      isActive: pathname === "/" || pathname === "/taste",
      badgeCount: selectedFilms.length,
    },
    {
      href: "/scout",
      label: "Scout",
      fullLabel: "Scout Cinema",
      icon: Search,
      isActive: pathname.startsWith("/scout"),
    },
    {
      href: activeUsername ? `/profile?user=${encodeURIComponent(activeUsername)}` : "/profile",
      label: "Profile",
      fullLabel: "My Profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
    {
      href: "/history",
      label: "Logs",
      fullLabel: "Search Logs",
      icon: Clock,
      isActive: pathname.startsWith("/history"),
    },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo with Custom MovieMatch Icon */}
        <Link
          href="/"
          className="flex items-center space-x-3 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center text-brand-green group-hover:border-brand-green group-hover:bg-brand-green/20 transition-all duration-200">
            <Film className="w-4 h-4 text-brand-green group-hover:scale-110 transition-transform duration-200" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-display">
              Movie<span className="text-brand-green">Match</span>
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Floating Pill */}
        <nav className="hidden sm:flex items-center space-x-1 bg-brand-darker/90 p-1 rounded-2xl border border-brand-border text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-colors z-10 select-none ${
                  item.isActive
                    ? "text-black font-bold"
                    : "text-brand-subtext hover:text-white font-medium"
                }`}
              >
                {item.isActive && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 bg-brand-green rounded-xl -z-10 shadow-md shadow-brand-green/25"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.fullLabel}</span>

                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      item.isActive
                        ? "bg-black text-brand-green"
                        : "bg-brand-orange text-white shadow-sm"
                    }`}
                  >
                    {item.badgeCount}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Status / Connect Pill */}
        <div className="flex items-center gap-2">
          {activeUsername ? (
            <div className="flex items-center space-x-2 bg-brand-card/90 px-3 py-1.5 rounded-xl border border-brand-border hover:border-brand-borderLight transition-colors">
              <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse"></div>
              <Link href={`/profile?user=${encodeURIComponent(activeUsername)}`} className="text-xs font-bold text-white font-mono hover:text-brand-green transition-colors">
                @{activeUsername}
              </Link>
              <button
                onClick={handleLogout}
                className="text-brand-muted hover:text-brand-orange ml-1 p-0.5 transition-colors cursor-pointer"
                title="Disconnect profile"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/profile"
              className="text-xs text-brand-subtext hover:text-white bg-brand-card border border-brand-border px-3 py-1.5 rounded-xl transition-colors font-medium flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-brand-green" />
              <span className="hidden sm:inline">Connect Profile</span>
              <span className="sm:hidden">Profile</span>
            </Link>
          )}

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="sm:hidden p-2 rounded-xl bg-brand-card border border-brand-border text-brand-subtext hover:text-white cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden border-b border-brand-border bg-brand-dark/95 backdrop-blur-xl px-4 py-3 space-y-1.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    item.isActive
                      ? "bg-brand-green text-black font-bold"
                      : "text-brand-subtext hover:bg-brand-card hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span>{item.fullLabel}</span>
                  </div>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        item.isActive
                          ? "bg-black text-brand-green"
                          : "bg-brand-orange text-white"
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
