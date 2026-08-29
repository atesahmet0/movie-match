"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, Mail, Lock, Loader2 } from "lucide-react";
import { submitWaitlistEmail } from "@/lib/api";

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
  featureTitle = "Extended Tier Feature",
  featureDescription = "Deep candidate exploration and high-volume matching are currently in preview. Enter your email to receive early access as soon as it launches!",
  featureKey = "extended_tier",
}: UpcomingFeatureModalProps) {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitWaitlistEmail(trimmed, featureKey);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage("Could not submit email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setErrorMessage("");
    setEmail("");
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className="relative w-full max-w-md bg-[#14181c] border border-brand-green/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-brand-green/10 z-10 overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-brand-green/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-brand-blue/15 blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-brand-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {isSuccess ? (
              /* Success State */
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-green/20 border border-brand-green/40 flex items-center justify-center text-brand-green">
                  <Check className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-white font-display">
                    You&apos;re on the early access list!
                  </h3>
                  <p className="text-xs text-brand-subtext max-w-xs mx-auto">
                    We&apos;ve registered <span className="text-white font-mono">{email}</span>. You&apos;ll be among the first to unlock {featureTitle}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-4 w-full bg-brand-darker hover:bg-brand-card text-white text-xs font-bold py-3 px-4 rounded-xl border border-brand-border transition-colors cursor-pointer"
                >
                  Continue with Basic Tier
                </button>
              </div>
            ) : (
              /* Input State */
              <div className="space-y-5">
                {/* Header & Feature Badge */}
                <div className="space-y-2.5">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-brand-green/15 border border-brand-green/30 text-brand-green text-[11px] font-bold tracking-wide uppercase font-mono">
                    <Lock className="w-3 h-3" />
                    <span>Upcoming Feature</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-display">
                    {featureTitle}
                  </h3>
                  <p className="text-xs text-brand-subtext leading-relaxed">
                    {featureDescription}
                  </p>
                </div>

                {/* Email Input & Submit (rendered as div to avoid nested forms in DOM) */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-brand-subtext mb-1.5 uppercase tracking-wider font-mono">
                      Your Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="cinephile@example.com"
                        className="w-full text-xs bg-brand-darker border border-brand-border focus:border-brand-green rounded-xl pl-10 pr-3 py-3 text-white placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-green transition-colors font-mono"
                      />
                    </div>
                    {errorMessage && (
                      <p className="text-xs text-brand-orange mt-1.5 font-medium">
                        {errorMessage}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-brand-green hover:bg-brand-greenHover disabled:opacity-50 text-black font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-lg shadow-brand-green/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Get Notified for Early Access</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-center text-brand-muted">
                  No spam. We&apos;ll only notify you when this feature becomes available.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
