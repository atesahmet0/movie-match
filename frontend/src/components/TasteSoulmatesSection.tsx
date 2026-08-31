/* Hallmark · component: TasteSoulmatesSection · genre: atmospheric · theme: Midnight Cinema
 * motion: radar-pulse · spring-card · button-lift · timer-shimmer
 */
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  MapPin,
  Clapperboard,
  ArrowRight,
  Radar,
} from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { fetchUserProfile } from "@/lib/api";
import { UserFilmItem, UserProfileDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TasteSoulmatesSectionProps {
  initialUser?: string;
  initialLocation?: string;
  initialFilms?: string[];
  /** Profile already resolved on the server; skips the client fetch. */
  initialProfile?: UserProfileDetail | null;
}

const DEMO_USERS = ["karsten", "davidehrlich", "verbakimatto"];
const POPULAR_LOCATIONS = ["Anywhere", "Ankara", "Istanbul", "London", "Berlin", "New York", "Tokyo"];

export default function TasteSoulmatesSection({
  initialUser = "",
  initialLocation = "",
  initialProfile = null,
}: TasteSoulmatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { activeUsername, setActiveUsername, addFilm, clearFilms } = useTaste();

  const [usernameInput, setUsernameInput] = useState(initialUser || activeUsername || "");
  const [userProfile, setUserProfile] = useState<UserProfileDetail | null>(initialProfile);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [targetLocation, setTargetLocation] = useState(
    initialLocation || initialProfile?.location || "Anywhere"
  );

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
        setProfileError(`Could not find public profile for @${clean}.`);
      }
    } catch {
      setProfileError("Failed to fetch profile.");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    // A shared link arrives with the profile already resolved server-side, so
    // only the connected-member state still needs adopting.
    if (initialProfile && activeUsername !== initialProfile.username) {
      setActiveUsername(initialProfile.username);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfile?.username]);

  useEffect(() => {
    const userToLoad = initialUser || activeUsername;
    if (userToLoad && !userProfile) {
      // Profile loading is intentionally triggered by the URL/local-storage input.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUser(userToLoad);
    }
  // Load only when the URL or persisted username changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser, activeUsername]);

  useEffect(() => {
    if (!isPending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setProfileError(
        "This profile has no pinned favorites yet. Pin some films on Letterboxd, then run the match again."
      );
      return;
    }

    const loc = overrideLocation || targetLocation || userProfile.location || "Anywhere";
    const run = Date.now();

    // The match runs here, on this member's pinned favorites. The scout tab
    // takes a film list; Movie Match takes a member.
    startTransition(() => {
      router.push(
        `/?user=${encodeURIComponent(userProfile.username)}&location=${encodeURIComponent(
          loc
        )}&run=${run}`
      );
    });
  };

  return (
    <div className="w-full space-y-4">
      {userProfile ? (
        <div className="workspace-panel p-5 sm:p-7">
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
                  className="h-12 w-12 rounded-lg border border-brand-border object-cover"
                />
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white">
                    {userProfile.display_name || userProfile.username}
                  </h2>
                  <span className="font-mono text-xs text-brand-muted">
                    @{userProfile.username}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-brand-subtext">
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
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUserProfile(null);
                  setActiveUsername("");
                  setUsernameInput("");
                }}
                className="text-brand-muted hover:text-[color:var(--color-error)]"
              >
                Switch User
              </Button>
            </div>
          </div>

          {/* 4 Favorite Films Visual Row */}
          <div className="py-5">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                <span>Pinned favorites</span>
              </span>
              <span className="text-sm text-brand-muted">
                Used as matching evidence
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(userProfile.favorite_films || []).map((film) => (
                <div
                  key={film.slug}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg border border-brand-border bg-brand-darker p-2.5"
                >
                  <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-md border border-brand-border bg-brand-card">
                    {film.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-muted">
                        <Clapperboard className="w-4 h-4 text-brand-green" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {film.title}
                    </p>
                    {film.year && (
                      <p className="mt-0.5 font-mono text-xs text-brand-muted">
                        {film.year}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Location Chips */}
          <div className="pb-5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-subtext">
                <MapPin className="w-3 h-3 text-brand-green" />
                <span>Location</span>
              </span>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setTargetLocation(loc)}
                  className={`inline-flex min-h-10 cursor-pointer items-center whitespace-nowrap rounded-lg border px-3 py-1 text-sm transition-colors ${
                    targetLocation.toLowerCase() === loc.toLowerCase()
                      ? "bg-brand-green text-black font-bold border-brand-green"
                      : "bg-brand-card text-brand-subtext hover:bg-brand-darker hover:text-white border-brand-border"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Click Match Button */}
          <Button
            type="button"
            variant="cinema"
            size="lg"
            onClick={() => handle1ClickSoulmates()}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <Radar className="w-5 h-5 text-black animate-spin" />
                </div>
                <span>Finding matches… ({elapsedSeconds.toFixed(1)}s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5" />
                <span>
                  Find matches in {targetLocation || userProfile.location || "Anywhere"}
                </span>
                <ArrowRight className="w-4.5 h-4.5" />
              </div>
            )}
          </Button>
        </div>
      ) : (
        /* Instant User Input for 1-Click Match */
        <div className="workspace-panel space-y-5 p-5 sm:p-7">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-white">
              Start with a Letterboxd profile
            </h2>
            <p className="mb-6 max-w-[52ch] text-sm text-brand-subtext">
              We’ll load the four films pinned to the public profile. You can review them before starting the match.
            </p>

            <form onSubmit={handleUserFormSubmit} className="space-y-3">
              <label htmlFor="letterboxd-username" className="block text-sm font-semibold text-white">
                Letterboxd username
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="letterboxd-username"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  placeholder="karsten"
                  leftElement={<span className="font-mono text-brand-green font-bold text-sm">@</span>}
                  className="pl-8.5"
                />

                <Button
                  type="submit"
                  variant="cinema"
                  disabled={isLoadingProfile || !usernameInput.trim()}
                  isLoading={isLoadingProfile}
                  className="px-5"
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  Load profile
                </Button>
              </div>

              {profileError && (
                <p role="alert" className="rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] p-3 text-sm text-[color:var(--color-error)]">
                  {profileError}
                </p>
              )}

              {/* Demo profile quick pills */}
              <div className="flex flex-wrap items-center gap-2 pt-3 text-sm text-brand-muted">
                <span>Try a public profile:</span>
                {DEMO_USERS.map((demo) => (
                  <button
                    key={demo}
                    type="button"
                    onClick={() => {
                      setUsernameInput(demo);
                      loadUser(demo);
                    }}
                    className="inline-flex min-h-10 cursor-pointer items-center whitespace-nowrap rounded-lg border border-brand-border bg-brand-darker px-3 py-1 font-mono text-xs text-brand-text transition-colors hover:bg-brand-cardHover"
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
