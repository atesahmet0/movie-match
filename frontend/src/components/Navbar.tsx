/* Hallmark · component: Navbar · archetype: N5 Floating Pill + N1b Masthead · theme: Midnight Cinema
 * motion: spring layoutId · badge-pop · tactile-hover
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Search, X, Menu } from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeUsername, setActiveUsername } = useTaste();
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
    },
    {
      href: "/scout",
      label: "Find Members",
      fullLabel: "Find Members",
      icon: Search,
      isActive: pathname.startsWith("/scout"),
    },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center cursor-pointer select-none group"
        >
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-display">
            Movie<span className="text-brand-green">Match</span>
          </span>
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
              </Link>
            );
          })}
        </nav>

        {/* Right Status / Mobile Menu Trigger */}
        <div className="flex items-center gap-2">
          {activeUsername && (
            <div className="flex items-center space-x-2 bg-brand-card/90 px-3 py-1.5 rounded-xl border border-brand-border hover:border-brand-borderLight transition-colors">
              <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse"></div>
              <span className="text-xs font-bold text-white font-mono">
                @{activeUsername}
              </span>
              <button
                onClick={handleLogout}
                className="text-brand-muted hover:text-brand-orange ml-1 p-0.5 transition-colors cursor-pointer"
                title="Disconnect user"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
