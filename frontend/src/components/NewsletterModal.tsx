/* Hallmark · component: NewsletterModal · genre: editorial utility · theme: Studio Projection
 * states: default · hover · focus · active · disabled · loading · error · success
 */
"use client";

import React, { useState } from "react";
import { Check, Mail, Sparkles, BellRing, Film } from "lucide-react";
import { subscribeNewsletter } from "@/lib/api";
import { trackNewsletterSubscribed } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTopic?: string;
  source?: string;
}

export default function NewsletterModal({
  isOpen,
  onClose,
  defaultTopic = "newsletter_and_updates",
  source = "modal",
}: NewsletterModalProps) {
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(defaultTopic);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await subscribeNewsletter(trimmed, {
        feature: topic,
        source: source,
      });

      if (response.success) {
        setIsSuccess(true);
        trackNewsletterSubscribed({
          source: source,
          feature: topic,
        });
      } else {
        setErrorMessage(response.message);
      }
    } catch {
      setErrorMessage("We couldn't save your address. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setIsSuccess(false);
    setErrorMessage("");
    setEmail("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-6 sm:p-8">
        {isSuccess ? (
          <div className="space-y-5 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green text-black">
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                You’re on the list.
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-brand-subtext leading-relaxed">
                We’ve subscribed <span className="font-semibold text-white">{email}</span>. You’ll receive occasional product release notes and cinema dispatches. Unsubscribe anytime.
              </DialogDescription>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                className="w-full"
              >
                Return to MovieMatch
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border bg-brand-darker text-brand-green">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-darker px-3 py-1 text-xs font-medium text-brand-muted">
                  <Film className="h-3.5 w-3.5 text-brand-green" />
                  Dispatches & Releases
                </span>
              </div>
              <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                Stay tuned for upcoming changes
              </DialogTitle>
              <DialogDescription className="text-sm text-brand-subtext leading-relaxed">
                Subscribe for early access to new scouting filters, compatibility algorithms, and occasional cinephile dispatches. Zero spam.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="newsletter-modal-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-brand-subtext"
                >
                  Email address
                </label>
                <Input
                  id="newsletter-modal-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="cinephile@example.com"
                  leftElement={<Mail className="h-4 w-4 text-brand-muted" />}
                  error={Boolean(errorMessage)}
                  aria-describedby="newsletter-email-help"
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>

              {/* Preference selector */}
              <div className="space-y-1.5 pt-1">
                <span className="block text-xs font-medium text-brand-muted">
                  What would you like to receive?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTopic("newsletter_and_updates")}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                      topic === "newsletter_and_updates"
                        ? "border-brand-green bg-brand-darker text-white"
                        : "border-brand-border bg-brand-dark text-brand-muted hover:border-brand-borderLight hover:text-brand-subtext"
                    }`}
                  >
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <BellRing className="h-3.5 w-3.5 text-brand-green" /> All updates
                    </span>
                    <span className="text-[11px] text-brand-muted leading-tight">
                      Releases & cinema dispatches
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTopic("features_only")}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                      topic === "features_only"
                        ? "border-brand-green bg-brand-darker text-white"
                        : "border-brand-border bg-brand-dark text-brand-muted hover:border-brand-borderLight hover:text-brand-subtext"
                    }`}
                  >
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-brand-green" /> Features only
                    </span>
                    <span className="text-[11px] text-brand-muted leading-tight">
                      Major feature launches only
                    </span>
                  </button>
                </div>
              </div>

              <p
                id="newsletter-email-help"
                className={`min-h-5 text-xs ${
                  errorMessage
                    ? "text-[color:var(--color-error)]"
                    : "text-brand-muted"
                }`}
              >
                {errorMessage || "One-click unsubscribe anytime. We respect your inbox."}
              </p>

              <Button
                type="submit"
                isLoading={isSubmitting}
                loadingText="Subscribing…"
                className="w-full h-11 text-sm font-bold"
              >
                Subscribe to updates
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
