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
  CheckCircle2,
} from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { fetchUserProfile } from "@/lib/api";
import { UserFilmItem, UserProfileDetail } from "@/lib/types";
import { motion } from "framer-motion";

interface TasteSoulmatesSectionProps {
  initialUser?: string;
  initialLocation?: string;
  initialFilms?: string[];
  initialMinShared?: number;
}

const DEMO_USERS = ["karsten", "davidehrlich", "verbakimatto"];

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

        // Set location if not already overridden
        if (data.profile.location && !initialLocation) {
          setTargetLocation(data.profile.location);
        } else if (!data.profile.location && !initialLocation) {
          setTargetLocation("Anywhere");
        }

        // Set favorite films in global context
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

  // Elapsed timer while search is running
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
        )}&user=${encodeURIComponent(userProfile.username)}&min_shared=${minShared}&max_pages=2`
      );
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {userProfile ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-6 sm:p-7 relative overflow-hidden"
        >
          {/* Header Profile Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2c3440] pb-5">
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
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-[#2c3440]"
                />
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-white text-base">
                    {userProfile.display_name || userProfile.username}
                  </h3>
                  <span className="text-xs font-mono text-[#40bcf4]">
                    @{userProfile.username}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-[#99aabb] mt-0.5">
                  {userProfile.location ? (
                    <span className="flex items-center gap-1 text-[#00e054]">
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
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="text-xs text-[#99aabb] hover:text-white px-3 py-1.5 rounded-xl border border-[#2c3440] bg-[#14181c] flex items-center space-x-1 cursor-pointer transition"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvanced ? "Hide Options" : "Filter Options"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserProfile(null);
                  setActiveUsername("");
                  setUsernameInput("");
                }}
                className="text-xs text-[#667788] hover:text-red-400 px-3 py-1.5 rounded-xl border border-[#2c3440] bg-[#14181c] cursor-pointer transition"
              >
                Switch User
              </button>
            </div>
          </div>

          {/* 4 Favorite Films Visual Row */}
          <div className="py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00e054]" />
                <span>Your Favorite Films (Matching Targets)</span>
              </span>
              <span className="text-[11px] font-mono text-[#99aabb]">
                Ranked by Compatibility Ratio
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(userProfile.favorite_films || []).map((film) => (
                <div
                  key={film.slug}
                  className="bg-[#14181c] border border-[#2c3440] rounded-xl p-2.5 flex items-center space-x-2.5 group hover:border-[#00e054]/50 transition"
                >
                  <div className="w-10 h-14 bg-[#1b2228] rounded-lg flex-shrink-0 overflow-hidden relative border border-[#2c3440]">
                    {film.poster_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#667788]">
                        <Clapperboard className="w-4 h-4 text-[#00e054]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white truncate group-hover:text-[#00e054] transition">
                      {film.title}
                    </p>
                    {film.year && (
                      <p className="text-[10px] font-mono text-[#99aabb] mt-0.5">
                        {film.year}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Filter Controls */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="pt-4 border-t border-[#2c3440] grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4"
            >
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Target Location (or Anywhere)
                </label>
                <input
                  type="text"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="e.g. Anywhere, Turkey, Berlin, London..."
                  className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2 text-white placeholder-[#667788] focus:outline-none focus:border-[#00e054]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Minimum Shared Films
                </label>
                <select
                  value={minShared}
                  onChange={(e) => setMinShared(parseInt(e.target.value) || 1)}
                  className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#00e054]"
                >
                  <option value={1}>Match at least 1 film (25%+ Ratio)</option>
                  <option value={2}>Match at least 2 films (50%+ Ratio)</option>
                  <option value={3}>Match at least 3 films (75%+ Ratio)</option>
                  <option value={4}>Match all 4 films (100% Perfect Match)</option>
                </select>
              </div>
            </motion.div>
          )}

          {/* 1-Click Match Button */}
          <button
            type="button"
            onClick={() => handle1ClickSoulmates()}
            disabled={isPending}
            className="w-full bg-gradient-to-r from-[#00e054] to-[#00b844] hover:from-[#00b844] hover:to-[#009e3a] disabled:opacity-50 text-[#0d1114] font-extrabold py-3.5 px-6 rounded-2xl transition duration-150 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer shadow-xl shadow-[#00e054]/15 group"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Discovering Your Taste Soulmates... ({elapsedSeconds.toFixed(1)}s)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition" />
                <span>
                  Find My Taste Soulmates in {targetLocation || userProfile.location || "Anywhere"}
                </span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </>
            )}
          </button>
        </motion.div>
      ) : (
        /* Instant User Input for 1-Click Match */
        <div className="glass-card p-6 sm:p-8 space-y-4 text-center">
          <div className="max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-extrabold text-white mb-1">
              Find Your Letterboxd Taste Soulmates
            </h2>
            <p className="text-xs text-[#99aabb] mb-5">
              Enter your Letterboxd username to automatically match your 4 pinned favorite films and location.
            </p>

            <form onSubmit={handleUserFormSubmit} className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <span className="absolute left-3.5 top-2.5 text-[#667788] text-sm font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required
                    placeholder="your-letterboxd-username"
                    className="w-full bg-[#14181c] border border-[#2c3440] rounded-xl pl-8 pr-4 py-2.5 text-white placeholder-[#667788] focus:outline-none focus:border-[#00e054] text-sm font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingProfile || !usernameInput.trim()}
                  className="bg-gradient-to-r from-[#00e054] to-[#00b844] hover:from-[#00b844] hover:to-[#009e3a] disabled:opacity-50 text-[#0d1114] font-extrabold px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-sm cursor-pointer whitespace-nowrap shadow-lg shadow-[#00e054]/10"
                >
                  {isLoadingProfile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Find Soulmates</span>
                </button>
              </div>

              {profileError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-800/40">
                  {profileError}
                </p>
              )}

              {/* Demo profile quick pills */}
              <div className="flex items-center justify-center gap-1.5 pt-2 text-xs text-[#99aabb]">
                <span>Try sample profile:</span>
                {DEMO_USERS.map((demo) => (
                  <button
                    key={demo}
                    type="button"
                    onClick={() => {
                      setUsernameInput(demo);
                      loadUser(demo);
                    }}
                    className="text-[#00e054] hover:underline cursor-pointer font-mono text-[11px] bg-[#14181c] px-2 py-0.5 rounded-lg border border-[#2c3440]"
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
