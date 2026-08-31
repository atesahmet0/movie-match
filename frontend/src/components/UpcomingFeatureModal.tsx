/* Hallmark · component: UpcomingFeatureModal · genre: editorial utility · theme: Studio Projection
 * states: default · hover · focus · active · disabled · loading · error · success
 */
"use client";

import React, { useState } from "react";
import { Check, Lock, Mail } from "lucide-react";
import { submitWaitlistEmail } from "@/lib/api";
import { trackWaitlistJoined } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface UpcomingFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureTitle?: string;
  featureDescription?: string;
  featureKey?: string;
}

export default function UpcomingFeatureModal({
  isOpen,
  onClose,
  featureTitle = "Extended search",
  featureDescription = "This search option is still in preview. Join the waitlist and we’ll send one message when it is available.",
  featureKey = "extended_tier",
}: UpcomingFeatureModalProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setErrorMessage("That email address is incomplete. Check it and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitWaitlistEmail(trimmed, featureKey);
      if (response.success) {
        setIsSuccess(true);
        trackWaitlistJoined({ featureKey });
      } else {
        setErrorMessage(response.message);
      }
    } catch {
      setErrorMessage("We couldn’t save that address. Try again in a moment.");
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
      <DialogContent className="max-w-md">
        {isSuccess ? (
          <div className="space-y-5 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-green text-black">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-2xl">You’re on the list.</DialogTitle>
              <p className="mt-2 text-sm text-brand-subtext">
                We’ll contact <span className="font-semibold text-white">{email}</span> when {featureTitle.toLowerCase()} is available.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} className="w-full">
              Return to search
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-brand-darker text-brand-subtext">
                <Lock className="h-4 w-4" />
              </div>
              <DialogTitle className="text-2xl">{featureTitle}</DialogTitle>
              <p className="mt-2 text-sm text-brand-subtext">{featureDescription}</p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              <label htmlFor="waitlist-email" className="block text-sm font-semibold text-white">
                Email address
              </label>
              <Input
                id="waitlist-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                leftElement={<Mail className="h-4 w-4" />}
                error={Boolean(errorMessage)}
                aria-describedby="waitlist-email-help"
              />
              <p
                id="waitlist-email-help"
                className={`min-h-5 text-sm ${errorMessage ? "text-[color:var(--color-error)]" : "text-brand-muted"}`}
              >
                {errorMessage || "One launch message. No newsletter."}
              </p>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving address…" className="w-full">
                Notify me
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
