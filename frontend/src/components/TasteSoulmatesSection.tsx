/* Hallmark · component: TasteSoulmatesSection · genre: atmospheric · theme: Midnight Cinema
 * motion: radar-pulse · spring-card · button-lift · timer-shimmer
 */
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  MapPin,
  Clapperboard,
  ArrowRight,
  Sliders,
  Heart,
  Radar,
  Radio,
} from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { fetchUserProfile } from "@/lib/api";
import { UserFilmItem, UserProfileDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface TasteSoulmatesSectionProps {
  initialUser?: string;
  initialLocation?: string;
  initialFilms?: string[];
  initialMinShared?: number;
}

const DEMO_USERS = ["karsten", "davidehrlich", "verbakimatto"];
const POPULAR_LOCATIONS = ["Anywhere", "Ankara", "Istanbul", "London", "Berlin", "New York", "Tokyo"];

export default function TasteSoulmatesSection({
  initialUser = "",
  initialLocation = "",
  initialFilms = [],
  initialMinShared = 1,
}: TasteSoulmatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { activeUsername, setActiveUsername, addFilm, clearFilms } = useTaste();

  const [usernameInput, setUsernameInput] = useState(initialUser || activeUsername || "");
  const [userProfile, setUserProfile] = useState<UserProfileDetail | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [targetLocation, setTargetLocation] = useState(initialLocation || "Anywhere");
  const [minShared, setMinShared] = useState(initialMinShared || 1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Status timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Load user profile if user is specified
  const loadUser = async (uname: string) => {
    const clean = uname.trim().replace(/^@/, "");
    if (!clean) return;

    setIsLoadingProfile(true);
    setProfileError("");

    try {
      const data = await fetchUserProfile(clean);
      if (data && data.profile) {
        setUserProfile(data.profile);
        setActiveUsername(clean);

        if (data.profile.location && !initialLocation) {
          setTargetLocation(data.profile.location);
        } else if (!data.profile.location && !initialLocation) {
          setTargetLocation("Anywhere");
        }

        if (data.profile.favorite_films && data.profile.favorite_films.length > 0) {
          clearFilms();
          data.profile.favorite_films.forEach((f: UserFilmItem) => {
            addFilm({
              slug: f.slug,
              title: f.title,
              year: f.year || null,
              poster_url: f.poster_url || null,
            });
          });
        }
      } else {
        setProfileError(`Could not find public Letterboxd profile for @${clean}.`);
      }
    } catch {
      setProfileError("Failed to fetch Letterboxd profile.");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    const userToLoad = initialUser || activeUsername;
    if (userToLoad && !userProfile) {
      loadUser(userToLoad);
    }
  }, [initialUser, activeUsername]);

  useEffect(() => {
    if (!isPending) {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [isPending]);

  const handleUserFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      loadUser(usernameInput.trim());
    }
  };

  const handle1ClickSoulmates = (overrideLocation?: string) => {
    if (!userProfile) return;

    const favoriteSlugs = (userProfile.favorite_films || []).map((f) => f.slug);
    if (favoriteSlugs.length === 0) {
      setProfileError("Your Letterboxd profile has no pinned 4 favorites yet. Please select films manually.");
      return;
    }

    const loc = overrideLocation || targetLocation || userProfile.location || "Anywhere";
    const filmsParam = favoriteSlugs.join(",");

    startTransition(() => {
      router.push(
        `/taste?films=${encodeURIComponent(filmsParam)}&location=${encodeURIComponent(
          loc
        )}&user=${encodeURIComponent(userProfile.username)}&minShared=${minShared}&maxPages=2`
      );
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {userProfile ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-6 sm:p-7 relative overflow-hidden rounded-3xl border border-brand-border/90 shadow-2xl"
        >
          {/* Header Profile Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/80 pb-5">
            <div className="flex items-center space-x-3.5">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    userProfile.avatar_url ||
                    "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png"
                  }
                  alt={userProfile.display_name || userProfile.username}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-brand-border"
                />
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-white text-base font-display">
                    {userProfile.display_name || userProfile.username}
                  </h3>
                  <span className="text-xs font-mono text-brand-blue">
                    @{userProfile.username}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-brand-subtext mt-0.5">
                  {userProfile.location ? (
                    <span className="flex items-center gap-1 text-brand-green font-medium">
                      <MapPin className="w-3 h-3" />
                      {userProfile.location}
                    </span>
                  ) : (
                    <span>Location: Anywhere</span>
                  )}
                  <span>&bull;</span>
                  <span>{userProfile.favorite_films?.length || 0} Pinned Favorites</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced((prev) => !prev)}
                leftIcon={<Sliders className="w-3.5 h-3.5" />}
              >
                <span>{showAdvanced ? "Hide Options" : "Options"}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUserProfile(null);
                  setActiveUsername("");
                  setUsernameInput("");
                }}
                className="text-brand-muted hover:text-red-400"
              >
                Switch User
              </Button>
            </div>
          </div>

          {/* 4 Favorite Films Visual Row */}
          <div className="py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                <span>Your Favorite Films (Matching Targets)</span>
              </span>
              <span className="text-[11px] font-mono text-brand-muted">
                Ranked by Compatibility Ratio
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(userProfile.favorite_films || []).map((film) => (
                <div
                  key={film.slug}
                  className="bg-brand-darker border border-brand-border rounded-xl p-2.5 flex items-center space-x-2.5 group hover:border-brand-green/50 transition-colors"
                >
                  <div className="w-10 h-14 bg-brand-card rounded-lg flex-shrink-0 overflow-hidden relative border border-brand-border">
                    {film.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-muted">
                        <Clapperboard className="w-4 h-4 text-brand-green" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white truncate group-hover:text-brand-green transition font-display">
                      {film.title}
                    </p>
                    {film.year && (
                      <p className="text-[10px] font-mono text-brand-muted mt-0.5">
                        {film.year}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Location Chips */}
          <div className="pt-2 pb-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-brand-muted font-mono mr-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-brand-green" />
                <span>Quick Location:</span>
              </span>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setTargetLocation(loc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer border ${
                    targetLocation.toLowerCase() === loc.toLowerCase()
                      ? "bg-brand-green text-black font-bold border-brand-green"
                      : "bg-brand-darker text-brand-subtext hover:text-white border-brand-border hover:border-brand-borderLight"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Filter Options Drawer */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 border-t border-brand-border grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Target Location Query
                  </label>
                  <Input
                    type="text"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    placeholder="e.g. Anywhere, Turkey, Berlin, London..."
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Minimum Shared Films
                  </label>
                  <select
                    value={minShared}
                    onChange={(e) => setMinShared(parseInt(e.target.value) || 1)}
                    className="w-full h-9 text-xs bg-brand-darker border border-brand-border rounded-xl px-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:border-brand-green/80 cursor-pointer font-medium"
                  >
                    <option value={1}>Match at least 1 film (25%+ Ratio)</option>
                    <option value={2}>Match at least 2 films (50%+ Ratio)</option>
                    <option value={3}>Match at least 3 films (75%+ Ratio)</option>
                    <option value={4}>Match all 4 films (100% Perfect Match)</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1-Click Match Button */}
          <Button
            type="button"
            variant="cinema"
            size="lg"
            onClick={() => handle1ClickSoulmates()}
            disabled={isPending}
            className="w-full h-13 text-sm font-bold shadow-xl shadow-brand-green/20"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <Radar className="w-5 h-5 text-black animate-spin" />
                  <span className="absolute w-2 h-2 rounded-full bg-brand-dark animate-ping" />
                </div>
                <span>Discovering Your Taste Soulmates... ({elapsedSeconds.toFixed(1)}s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5" />
                <span>
                  Find My Taste Soulmates in {targetLocation || userProfile.location || "Anywhere"}
                </span>
                <ArrowRight className="w-4.5 h-4.5" />
              </div>
            )}
          </Button>
        </motion.div>
      ) : (
        /* Instant User Input for 1-Click Match */
        <div className="glass-card p-6 sm:p-8 space-y-4 text-center rounded-3xl border border-brand-border/90 shadow-2xl">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5 font-display">
              Find Your <span className="text-brand-green">Letterboxd Taste Soulmates</span>
            </h2>
            <p className="text-xs text-brand-subtext mb-6 leading-relaxed">
              Enter your Letterboxd username to automatically load your 4 pinned favorite films and discover cinephiles who match your taste.
            </p>

            <form onSubmit={handleUserFormSubmit} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  placeholder="your-letterboxd-username"
                  leftElement={<span className="font-mono text-brand-green font-bold text-sm">@</span>}
                  className="h-11 text-xs sm:text-sm pl-8.5"
                />

                <Button
                  type="submit"
                  variant="cinema"
                  disabled={isLoadingProfile || !usernameInput.trim()}
                  isLoading={isLoadingProfile}
                  className="h-11 px-5 whitespace-nowrap"
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  Find Soulmates
                </Button>
              </div>

              {profileError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-800/40 font-mono">
                  {profileError}
                </p>
              )}

              {/* Demo profile quick pills */}
              <div className="flex items-center justify-center gap-1.5 pt-3 text-xs text-brand-muted font-mono">
                <span>Sample cinephiles:</span>
                {DEMO_USERS.map((demo) => (
                  <button
                    key={demo}
                    type="button"
                    onClick={() => {
                      setUsernameInput(demo);
                      loadUser(demo);
                    }}
                    className="text-brand-green hover:underline cursor-pointer text-[11px] bg-brand-darker px-2 py-0.5 rounded-lg border border-brand-border"
                  >
                    @{demo}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
