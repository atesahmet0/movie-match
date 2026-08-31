/* Hallmark · component: Footer · archetype: Ft2 inline single line · theme: Studio Projection
 * states: default · hover · focus · active · disabled · loading · error · success
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Check, Sparkles, ArrowRight } from "lucide-react";
import { subscribeNewsletter } from "@/lib/api";
import NewsletterModal from "@/components/NewsletterModal";

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inlineEmail, setInlineEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineSuccess, setInlineSuccess] = useState(false);
  const [inlineError, setInlineError] = useState("");

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");

    const trimmed = inlineEmail.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setInlineError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await subscribeNewsletter(trimmed, {
        feature: "newsletter_and_updates",
        source: "footer_inline",
      });

      if (res.success) {
        setInlineSuccess(true);
        setInlineEmail("");
      } else {
        setInlineError(res.message);
      }
    } catch {
      setInlineError("Could not subscribe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="mt-auto border-t border-brand-border bg-brand-dark/40">
      <div className="mx-auto flex w-full max-w-[86rem] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-12">
        {/* Newsletter & Updates Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-brand-border/60 bg-brand-darker/60 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-green/10 text-brand-green">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-bold text-white tracking-tight">
                MovieMatch Dispatches & Release Notes
              </span>
            </div>
            <p className="text-xs text-brand-muted sm:text-sm">
              Get notified about new cinema matching filters, Letterboxd sync algorithms, and product updates.
            </p>
          </div>

          <div className="w-full md:w-auto min-w-[280px] max-w-md">
            {inlineSuccess ? (
              <div className="flex items-center gap-2 rounded-lg border border-brand-green/30 bg-brand-green/10 px-3.5 py-2.5 text-xs text-brand-green font-medium">
                <Check className="h-4 w-4 shrink-0 stroke-[2.5]" />
                <span>You’re subscribed to dispatches! Check your inbox soon.</span>
              </div>
            ) : (
              <form onSubmit={handleInlineSubmit} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted" />
                    <input
                      type="email"
                      required
                      value={inlineEmail}
                      onChange={(e) => {
                        setInlineEmail(e.target.value);
                        if (inlineError) setInlineError("");
                      }}
                      placeholder="Enter your email…"
                      aria-label="Email for newsletter and updates"
                      disabled={isSubmitting}
                      className="h-9 w-full rounded-lg border border-brand-border bg-brand-dark px-3 pl-8 text-xs font-medium text-white placeholder:text-brand-muted transition-colors focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-green px-3.5 text-xs font-bold text-black transition hover:bg-brand-greenHover active:scale-95 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "…" : "Subscribe"}
                    {!isSubmitting && <ArrowRight className="h-3 w-3" />}
                  </button>
                </div>
                {inlineError && (
                  <p className="text-[11px] text-[color:var(--color-error)]">
                    {inlineError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Bottom links and attribution */}
        <div className="flex flex-col gap-3 text-xs sm:text-sm text-brand-muted md:flex-row md:items-center md:justify-between pt-2 border-t border-brand-border/40">
          <p className="m-0 text-xs">
            MovieMatch finds public Letterboxd members through shared favorite films and location.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap text-xs">
            <Link href="/" className="text-brand-subtext underline-offset-4 hover:text-white hover:underline">
              Match by taste
            </Link>
            <Link href="/scout" className="text-brand-subtext underline-offset-4 hover:text-white hover:underline">
              Scout members
            </Link>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-brand-subtext underline-offset-4 hover:text-white hover:underline cursor-pointer bg-transparent border-0 p-0 text-xs font-normal"
            >
              Newsletter & updates
            </button>
            <a
              href="https://letterboxd.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-subtext underline-offset-4 hover:text-white hover:underline"
            >
              Data from Letterboxd
            </a>
          </div>
        </div>
      </div>

      <NewsletterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        source="footer_modal"
      />
    </footer>
  );
}
