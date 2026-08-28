"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  MapPin,
  Clapperboard,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { fetchUserProfile } from "@/lib/api";
import { UserFilmItem, UserProfileDetail } from "@/lib/types";

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
    } catch (e) {
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
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds((Date.now() - startTime) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [isPending]);

  const handle1ClickSoulmates = (profileOverride?: UserProfileDetail) => {
    const activeProf = profileOverride || userProfile;
    if (!activeProf) return;

    const favoriteSlugs = (activeProf.favorite_films || []).map((f) => f.slug);
    const recentSlugs = (activeProf.recent_films || []).slice(0, 4).map((f) => f.slug);
    const filmSlugs = favoriteSlugs.length > 0 ? favoriteSlugs : recentSlugs;

    if (filmSlugs.length === 0) {
      alert("No films found in your profile to match.");
      return;
    }

    startTransition(() => {
      const params = new URLSearchParams();
      params.set("user", activeProf.username);
      params.set("films", filmSlugs.join(","));
      params.set("location", targetLocation.trim() || activeProf.location || "Anywhere");
      params.set("minShared", String(minShared));
      params.set("maxPages", "2");
      router.push(`/taste?${params.toString()}`);
    });
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@/, "");
    if (!clean) return;

    setIsLoadingProfile(true);
    setProfileError("");

    try {
      const data = await fetchUserProfile(clean);
      if (data && data.profile) {
        setUserProfile(data.profile);
        setActiveUsername(clean);
        if (data.profile.location) {
          setTargetLocation(data.profile.location);
        }
        // Immediately run soulmates match with 1 click!
        handle1ClickSoulmates(data.profile);
      } else {
        setProfileError(`Could not find profile for @${clean}.`);
      }
    } catch (err) {
      setProfileError("Error fetching profile.");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* 1-Click Soulmates Match Panel */}
      {userProfile ? (
        <div className="solid-card rounded-2xl p-6 sm:p-7 border-brand-green/30 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-brand-border">
            <div className="flex items-center space-x-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  userProfile.avatar_url ||
                  "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png"
                }
                alt={userProfile.display_name || userProfile.username}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover border border-brand-border"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white">
                    {userProfile.display_name || userProfile.username}
                  </h3>
                  <a
                    href={userProfile.profile_url || `https://letterboxd.com/${userProfile.username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-brand-blue hover:underline"
                  >
                    @{userProfile.username}
                  </a>
                </div>
                <div className="flex items-center space-x-2 mt-0.5 text-xs text-brand-subtext">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-brand-green" />
                    <span>{targetLocation || userProfile.location || "Anywhere"}</span>
                  </span>
                  <span>&bull;</span>
                  <span>{userProfile.favorite_films?.length || 0} Pinned Favorites</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="text-xs text-brand-muted hover:text-white px-3 py-1.5 rounded-xl border border-brand-border bg-brand-darker flex items-center space-x-1 cursor-pointer transition"
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
                className="text-xs text-brand-muted hover:text-red-400 px-3 py-1.5 rounded-xl border border-brand-border bg-brand-darker cursor-pointer transition"
              >
                Switch User
              </button>
            </div>
          </div>

          {/* 4 Favorite Films Visual Row */}
          <div className="py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                <span>Your Favorite Films (Matching Targets)</span>
              </span>
              <span className="text-[11px] font-mono text-brand-subtext">
                Ranked by Compatibility Ratio
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(userProfile.favorite_films || []).map((film) => (
                <div
                  key={film.slug}
                  className="bg-brand-darker border border-brand-border rounded-xl p-2.5 flex items-center space-x-2.5 group hover:border-brand-green/50 transition"
                >
                  <div className="w-10 h-14 bg-brand-card rounded-md flex-shrink-0 overflow-hidden relative border border-brand-border">
                    {film.poster_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-muted">
                        <Clapperboard className="w-4 h-4 text-brand-green" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white truncate group-hover:text-brand-green transition">
                      {film.title}
                    </p>
                    {film.year && (
                      <p className="text-[10px] font-mono text-brand-subtext mt-0.5">
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
            <div className="pt-4 border-t border-brand-border grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 animate-in fade-in-50 duration-150">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Target Location (or Anywhere)
                </label>
                <input
                  type="text"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="e.g. Anywhere, Turkey, Berlin, London..."
                  className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-white placeholder-brand-muted focus:outline-none glow-focus"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Minimum Shared Films
                </label>
                <select
                  value={minShared}
                  onChange={(e) => setMinShared(parseInt(e.target.value) || 1)}
                  className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-white focus:outline-none glow-focus"
                >
                  <option value={1}>Match at least 1 film (25%+ Ratio)</option>
                  <option value={2}>Match at least 2 films (50%+ Ratio)</option>
                  <option value={3}>Match at least 3 films (75%+ Ratio)</option>
                  <option value={4}>Match all 4 films (100% Perfect Match)</option>
                </select>
              </div>
            </div>
          )}

          {/* THE SINGLE 1-CLICK BUTTON */}
          <button
            type="button"
            onClick={() => handle1ClickSoulmates()}
            disabled={isPending}
            className="w-full bg-brand-green hover:bg-brand-greenHover disabled:opacity-50 text-black font-extrabold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer shadow-xl shadow-brand-green/20 group"
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
        </div>
      ) : (
        /* Instant User Input for 1-Click Match */
        <div className="solid-card rounded-2xl p-6 sm:p-7 space-y-4 text-center">
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-white mb-1">
              Find Your Letterboxd Taste Soulmates
            </h2>
            <p className="text-xs text-brand-subtext mb-4">
              Enter your Letterboxd username to automatically match your 4 pinned favorite films and location.
            </p>

            <form onSubmit={handleUserFormSubmit} className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <span className="absolute left-3.5 top-2.5 text-brand-muted text-sm font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required
                    placeholder="your-letterboxd-username"
                    className="w-full bg-brand-darker border border-brand-border rounded-xl pl-8 pr-4 py-2.5 text-white placeholder-brand-muted focus:outline-none glow-focus text-sm font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingProfile || !usernameInput.trim()}
                  className="bg-brand-green hover:bg-brand-greenHover disabled:opacity-50 text-black font-bold px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-sm cursor-pointer whitespace-nowrap shadow-lg shadow-brand-green/10"
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
                <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800/40">
                  {profileError}
                </p>
              )}

              {/* Demo profile quick pills */}
              <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-brand-subtext">
                <span>Try sample profile:</span>
                {DEMO_USERS.map((demo) => (
                  <button
                    key={demo}
                    type="button"
                    onClick={() => {
                      setUsernameInput(demo);
                      loadUser(demo);
                    }}
                    className="text-brand-green hover:underline cursor-pointer font-mono text-[11px] bg-brand-darker px-2 py-0.5 rounded border border-brand-border"
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
