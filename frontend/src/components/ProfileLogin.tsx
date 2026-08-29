/* Hallmark · component: ProfileLogin · genre: atmospheric · theme: Midnight Cinema
 * motion: spring-card · button-lift · pill-stagger
 */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Zap, Sparkles, Clapperboard, Compass } from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProfileLogin() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setActiveUsername } = useTaste();

  const handleConnect = (uname: string) => {
    const clean = uname.trim().replace(/^@/, "");
    if (!clean) return;
    setLoading(true);
    setActiveUsername(clean);
    router.push(`/profile?user=${encodeURIComponent(clean)}`);
  };

  const DEMO_PROFILES = [
    { username: "karsten", tag: "Popular", bio: "Film Critic & Cinephile" },
    { username: "davidehrlich", tag: "IndieWire", bio: "Senior Film Critic" },
    { username: "verbakimatto", tag: "Curator", bio: "Cinephile & Writer" },
    { username: "letterboxd", tag: "Official", bio: "HQ Curations" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-2xl mx-auto py-8 sm:py-12"
    >
      <div className="glass-card rounded-3xl p-6 sm:p-10 border border-brand-border/90 relative overflow-hidden shadow-2xl">
        {/* Glow ambient highlight */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand-green/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-brand-orange/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center">
          {/* Cinema Icon Badge */}
          <motion.div
            whileHover={{ scale: 1.05, rotate: 3 }}
            className="w-16 h-16 rounded-2xl bg-brand-card border border-brand-border flex items-center justify-center mx-auto mb-5 text-brand-green shadow-xl shadow-brand-green/10"
          >
            <Clapperboard className="w-8 h-8" />
          </motion.div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2.5 font-display">
            Connect Your <span className="text-brand-green">Profile</span>
          </h1>

          <p className="text-brand-subtext text-xs sm:text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Enter your public username to load your 4 pinned favorites, personal library, and find cinephiles in your city who match your taste.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnect(username);
            }}
            className="space-y-4 max-w-md mx-auto"
          >
            <div className="relative">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g. karsten or your username"
                leftElement={<span className="font-mono text-brand-green font-bold text-sm">@</span>}
                className="h-12 text-sm bg-brand-darker/90 rounded-2xl pl-9"
              />
            </div>

            <Button
              type="submit"
              variant="cinema"
              size="lg"
              isLoading={loading}
              loadingText="Connecting Profile..."
              className="w-full h-12 text-sm font-bold shadow-lg shadow-brand-green/20"
              leftIcon={<Zap className="w-4 h-4" />}
            >
              Load Cinema Profile & Movies
            </Button>
          </form>

          {/* Quick Test Profiles */}
          <div className="mt-8 pt-6 border-t border-brand-border/60">
            <div className="flex items-center justify-center gap-1.5 text-xs text-brand-muted mb-3 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
              <span>Quick test cinephile profiles:</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEMO_PROFILES.map((profile) => (
                <button
                  key={profile.username}
                  type="button"
                  onClick={() => handleConnect(profile.username)}
                  className="group p-2.5 rounded-xl bg-brand-card/90 border border-brand-border hover:border-brand-green/60 text-left transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-white group-hover:text-brand-green truncate">
                    <span>@{profile.username}</span>
                  </div>
                  <div className="text-[10px] text-brand-muted truncate mt-0.5">
                    {profile.tag}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
