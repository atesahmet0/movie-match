/* Hallmark · component: Navbar · archetype: N1a two-destination masthead · theme: Studio Projection
 * states: default · hover · focus · active · disabled · loading · error · success
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTaste } from "@/lib/taste-context";

const navItems = [
  { href: "/", label: "Match by taste" },
  { href: "/scout", label: "Scout members" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeUsername, setActiveUsername } = useTaste();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname === "/taste" : pathname.startsWith(href);

  const disconnect = () => {
    setActiveUsername("");
    router.push("/");
  };

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="mx-auto flex h-16 w-full max-w-[86rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-12">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap font-display text-xl font-bold tracking-[-0.03em] text-white"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 bg-brand-green" />
          MovieMatch
        </Link>

        <nav className="hidden items-stretch self-stretch md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`inline-flex items-center whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors ${
                isActive(item.href)
                  ? "border-brand-green text-white"
                  : "border-transparent text-brand-subtext hover:border-brand-borderLight hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {activeUsername && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-36 truncate font-mono text-xs text-brand-subtext">
                @{activeUsername}
              </span>
              <button
                type="button"
                onClick={disconnect}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-brand-card text-brand-subtext transition-colors hover:bg-brand-darker hover:text-white"
                aria-label={`Disconnect @${activeUsername}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-brand-card text-white transition-colors hover:bg-brand-darker md:hidden"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="border-t border-brand-border bg-brand-dark px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-[86rem] gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex min-h-11 items-center justify-between whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${
                  isActive(item.href) ? "bg-brand-green text-black" : "text-white hover:bg-brand-darker"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {activeUsername && (
              <button
                type="button"
                onClick={disconnect}
                className="flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm text-brand-subtext hover:bg-brand-darker hover:text-white"
              >
                <span className="truncate">Disconnect @{activeUsername}</span>
                <X className="h-4 w-4 shrink-0" />
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
